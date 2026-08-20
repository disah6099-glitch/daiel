import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, submissionsTable } from "@workspace/db";
import {
  ApproveSubmissionParams,
  ApproveSubmissionResponse,
  CreateSubmissionBody,
  CreateSubmissionResponse,
  GetAdminSummaryResponse,
  GetPaymentConfigResponse,
  GetSubmissionParams,
  GetSubmissionResponse,
  InitializePaymentParams,
  InitializePaymentResponse,
  ListSubmissionsQueryParams,
  ListSubmissionsResponse,
  LookupStaffQueryParams,
  LookupStaffResponse,
  MarkSubmissionPaidParams,
  MarkSubmissionPaidResponse,
  VerifyPaymentResponse,
  UpdateSubmissionBody,
  UpdateSubmissionParams,
  UpdateSubmissionResponse,
  VerifyPaymentBody,
  VerifyPaymentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const PAYMENT_AMOUNT = 1_050_000;

function parseId(raw: string | string[]): number {
  return Number.parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

function masked(value: string): string {
  return `${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}

function toResponse(row: typeof submissionsTable.$inferSelect) {
  return {
    ...row,
    monthlySalary: Number(row.monthlySalary),
  };
}

function notificationMessage(name: string): string {
  return `Congratulations ${name}, your payment has been verified and you have been approved for the housing loan.`;
}

router.get("/portal/lookup", async (req, res): Promise<void> => {
  const parsed = LookupStaffQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select({ staffId: submissionsTable.staffId, name: submissionsTable.name })
    .from(submissionsTable)
    .where(eq(submissionsTable.staffId, parsed.data.staffId))
    .limit(1);
  res.json(LookupStaffResponse.parse({
    found: true,
    staffId: parsed.data.staffId,
    name: existing?.name ?? "Staff member",
    existingRecord: Boolean(existing),
  }));
});

router.post("/submissions", async (req, res): Promise<void> => {
  const parsed = CreateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(submissionsTable).values({
    staffId: parsed.data.staffId,
    name: parsed.data.name,
    address: parsed.data.address,
    phone: parsed.data.phone,
    email: parsed.data.email,
    monthlySalary: String(parsed.data.monthlySalary),
    nextOfKin: parsed.data.nextOfKin,
    verificationType: parsed.data.verificationType,
    verificationMasked: masked(parsed.data.verificationValue),
  }).returning();
  res.status(201).json(CreateSubmissionResponse.parse(toResponse(created)));
});

router.get("/submissions", async (req, res): Promise<void> => {
  const parsed = ListSubmissionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [];
  if (parsed.data.status && parsed.data.status !== "all") {
    conditions.push(eq(submissionsTable.status, parsed.data.status));
  }
  if (parsed.data.search) {
    const term = `%${parsed.data.search}%`;
    conditions.push(or(ilike(submissionsTable.name, term), ilike(submissionsTable.staffId, term)));
  }
  const rows = await db.select().from(submissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(submissionsTable.createdAt));
  res.json(ListSubmissionsResponse.parse(rows.map(toResponse)));
});

router.get("/submissions/:id", async (req, res): Promise<void> => {
  const parsed = GetSubmissionParams.safeParse({ id: parseId(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, parsed.data.id));
  if (!row) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  res.json(GetSubmissionResponse.parse(toResponse(row)));
});

router.patch("/submissions/:id", async (req, res): Promise<void> => {
  const params = UpdateSubmissionParams.safeParse({ id: parseId(req.params.id) });
  const body = UpdateSubmissionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.update(submissionsTable).set({
    ...body.data,
    monthlySalary: body.data.monthlySalary == null ? undefined : String(body.data.monthlySalary),
    updatedAt: new Date(),
  }).where(eq(submissionsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  res.json(UpdateSubmissionResponse.parse(toResponse(row)));
});

router.post("/submissions/:id/payment/initialize", async (req, res): Promise<void> => {
  const params = InitializePaymentParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  await db.update(submissionsTable).set({ paymentStatus: "pending", updatedAt: new Date() })
    .where(eq(submissionsTable.id, row.id));
  res.json(InitializePaymentResponse.parse({
    amount: PAYMENT_AMOUNT,
    email: row.email,
    name: row.name,
    staffId: row.staffId,
  }));
});

router.post("/submissions/:id/payment/verify", async (req, res): Promise<void> => {
  const params = VerifyPaymentParams.safeParse({ id: parseId(req.params.id) });
  const body = VerifyPaymentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    res.status(503).json({ error: "Paystack is not configured" });
    return;
  }
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(body.data.reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await response.json() as { status?: boolean; data?: { status?: string; amount?: number; reference?: string } };
  if (!response.ok || !payload.status || payload.data?.status !== "success" || payload.data.amount !== PAYMENT_AMOUNT) {
    req.log.warn({ submissionId: row.id, reference: body.data.reference }, "Paystack verification failed");
    res.status(400).json({ error: "Payment could not be verified" });
    return;
  }
  const [updated] = await db.update(submissionsTable).set({
    paymentStatus: "paid",
    status: "payment_verified",
    paymentReference: payload.data.reference ?? body.data.reference,
    notificationStatus: "sent",
    updatedAt: new Date(),
  }).where(eq(submissionsTable.id, row.id)).returning();
  const message = notificationMessage(row.name);
  req.log.info({ submissionId: row.id, reference: body.data.reference, userEmail: row.email, message }, "Approval notification simulated");
  res.json(VerifyPaymentResponse.parse({
    status: "verified",
    reference: updated.paymentReference ?? body.data.reference,
    message,
  }));
});

router.post("/submissions/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveSubmissionParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.update(submissionsTable).set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(submissionsTable.id, params.data.id), eq(submissionsTable.paymentStatus, "paid"))).returning();
  if (!row) {
    res.status(400).json({ error: "Submission must have a verified payment before approval" });
    return;
  }
  res.json(ApproveSubmissionResponse.parse(toResponse(row)));
});

router.post("/submissions/:id/mark-paid", async (req, res): Promise<void> => {
  const params = MarkSubmissionPaidParams.safeParse({ id: parseId(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.update(submissionsTable).set({
    paymentStatus: "paid",
    status: "payment_verified",
    paymentReference: "MANUAL-PAID",
    notificationStatus: "sent",
    updatedAt: new Date(),
  }).where(eq(submissionsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  res.json(MarkSubmissionPaidResponse.parse(toResponse(row)));
});

router.get("/admin/summary", async (_req, res): Promise<void> => {
  const rows = await db.select().from(submissionsTable);
  const activity = rows.slice(0, 5).map((row) => ({
    id: row.id,
    label: row.status === "approved" ? "Submission approved" : row.paymentStatus === "paid" ? "Payment verified" : "New submission",
    detail: `${row.name} · ${row.staffId}`,
    createdAt: row.updatedAt,
  }));
  res.json(GetAdminSummaryResponse.parse({
    totalSubmissions: rows.length,
    pendingReview: rows.filter((row) => row.status === "pending").length,
    paymentVerified: rows.filter((row) => row.status === "payment_verified").length,
    approved: rows.filter((row) => row.status === "approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    recentActivity: activity,
  }));
});

router.get("/payments/config", async (_req, res): Promise<void> => {
  res.json(GetPaymentConfigResponse.parse({
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
    amount: PAYMENT_AMOUNT,
  }));
});

export default router;