import { createInsertSchema } from "drizzle-zod";
import { numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  staffId: text("staff_id").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  monthlySalary: numeric("monthly_salary", { precision: 14, scale: 2 }).notNull(),
  nextOfKin: text("next_of_kin").notNull(),
  verificationType: text("verification_type").notNull(),
  verificationMasked: text("verification_masked").notNull(),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentReference: text("payment_reference"),
  notificationStatus: text("notification_status").notNull().default("not_sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;