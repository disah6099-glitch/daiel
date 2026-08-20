import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Home,
  Info,
  Landmark,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  getGetAdminSummaryQueryKey,
  getGetPaymentConfigQueryKey,
  getGetSubmissionQueryKey,
  getHealthCheckQueryKey,
  getListSubmissionsQueryKey,
  getLookupStaffQueryKey,
  useApproveSubmission,
  useCreateSubmission,
  useGetAdminSummary,
  useGetPaymentConfig,
  useGetSubmission,
  useHealthCheck,
  useInitializePayment,
  useListSubmissions,
  useLookupStaff,
  useMarkSubmissionPaid,
  useUpdateSubmission,
  useVerifyPayment,
} from '@workspace/api-client-react';
import type { Submission } from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const steps = [
  { label: 'Identify staff', short: 'Staff', icon: UserRound },
  { label: 'Security check', short: 'Verify', icon: ShieldCheck },
  { label: 'Your details', short: 'Details', icon: FileText },
  { label: 'Payment & confirm', short: 'Payment', icon: Banknote },
];
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const salaryAmount = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
const statusText: Record<string, string> = {
  pending: 'Awaiting review',
  payment_verified: 'Payment verified',
  approved: 'Approved',
  rejected: 'Rejected',
  unpaid: 'Not paid',
  pending_payment: 'Payment pending',
  paid: 'Paid',
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref?: string;
        metadata?: { custom_fields: Array<{ display_name: string; variable_name: string; value: string }> };
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

async function loadPaystack(): Promise<void> {
  if (window.PaystackPop) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paystack-inline]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Paystack could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.dataset.paystackInline = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Paystack could not load'));
    document.body.appendChild(script);
  });
}

function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...props}
      className={cn(
        'focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-primary text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/.18)] hover:brightness-95',
        variant === 'secondary' && 'border border-border bg-card text-foreground hover:bg-secondary',
        variant === 'ghost' && 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        variant === 'danger' && 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" data-testid="link-home" className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_14px_hsl(var(--primary)/.22)]">
        <Landmark size={21} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-bold tracking-[-.02em] text-[#153b83]">National Housing Fund</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Data services portal</span>
        </span>
      )}
    </Link>
  );
}

function TopBar({ admin = false }: { admin?: boolean }) {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 120_000 } });
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo compact={false} />
        <div className="flex items-center gap-2 sm:gap-5">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex" data-testid="status-portal-health">
            <span className={cn('size-2 rounded-full', health.isError ? 'bg-red-500' : health.isLoading ? 'bg-amber-400' : 'bg-emerald-500')} />
            {health.isError ? 'Service issue' : 'Portal online'}
          </div>
          {admin ? (
            <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-5">
              <span className="grid size-8 place-items-center rounded-full bg-[#e7efff] text-xs font-bold text-primary">AO</span>
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-semibold">Admin office</div>
                <div className="text-[11px] text-muted-foreground">Review desk</div>
              </div>
              <ChevronDown size={15} className="text-muted-foreground" />
            </div>
          ) : (
            <Link href="/admin" data-testid="link-admin" className="hidden text-xs font-semibold text-primary hover:underline sm:block">Staff sign-in</Link>
          )}
        </div>
      </div>
    </header>
  );
}

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8 grid grid-cols-4 gap-1 sm:gap-3" data-testid="step-progress">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const complete = index < current;
        const active = index === current;
        return (
          <div key={step.label} className="relative">
            {index > 0 && <span className={cn('absolute -left-1/2 top-5 hidden h-px w-full sm:block', complete || active ? 'bg-primary' : 'bg-border')} />}
            <div className="relative flex flex-col items-center gap-2 text-center">
              <span className={cn(
                'grid size-10 place-items-center rounded-full border text-sm transition duration-300',
                complete ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary bg-[#e9f0ff] text-primary ring-4 ring-[#e9f0ff]' : 'border-border bg-card text-muted-foreground',
              )}>
                {complete ? <Check size={17} strokeWidth={3} /> : <Icon size={17} />}
              </span>
              <span className={cn('hidden text-[11px] font-semibold sm:block', active || complete ? 'text-[#153b83]' : 'text-muted-foreground')}>{step.label}</span>
              <span className={cn('text-[10px] font-semibold sm:hidden', active ? 'text-primary' : 'text-muted-foreground')}>{step.short}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; 'data-testid'?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#2c3f5c]">{label}</span>
      <input
        {...props}
        data-testid={props['data-testid'] ?? `input-${props.name}`}
        className={cn('focus-ring min-h-12 w-full rounded-xl border bg-card px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-[#a0adbc] focus:border-primary', error ? 'border-red-400' : 'border-input')}
      />
      {hint && !error && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600" data-testid={`error-${props.name}`}>{error}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  testId: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#2c3f5c]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} className="focus-ring min-h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] outline-none focus:border-primary">
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error'; children: ReactNode }) {
  return (
    <div className={cn(
      'flex gap-3 rounded-xl border px-3.5 py-3 text-sm',
      tone === 'info' && 'border-[#c9dafc] bg-[#f1f6ff] text-[#31558f]',
      tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
      tone === 'error' && 'border-red-200 bg-red-50 text-red-700',
    )}>
      {tone === 'info' ? <Info size={17} className="mt-0.5 shrink-0" /> : tone === 'success' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <XCircle size={17} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <TopBar />
      {children}
      <footer className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Federal Mortgage Bank of Nigeria</span>
        <span className="flex items-center gap-1.5"><LockKeyhole size={13} /> Your information is handled securely</span>
      </footer>
    </div>
  );
}

function ApplicantPortal() {
  const [step, setStep] = useState(0);
  const [staffId, setStaffId] = useState('');
  const [lookupInput, setLookupInput] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookup, setLookup] = useState<{ found: boolean; staffId: string; name: string; existingRecord?: boolean } | null>(null);
  const [verificationType, setVerificationType] = useState('BVN');
  const [verificationValue, setVerificationValue] = useState('');
  const [details, setDetails] = useState({ name: '', address: '', phone: '', email: '', monthlySalary: '', nextOfKin: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paidConfirmed, setPaidConfirmed] = useState(false);
  const [createdMessage, setCreatedMessage] = useState('');
  const lookupQuery = useLookupStaff(
    { staffId: lookupInput || 'not-started' },
    { query: { enabled: false, queryKey: getLookupStaffQueryKey({ staffId: lookupInput || 'not-started' }) } },
  );
  const createSubmission = useCreateSubmission();
  const initializePayment = useInitializePayment();
  const verifyPayment = useVerifyPayment();
  const paymentConfig = useGetPaymentConfig({ query: { queryKey: getGetPaymentConfigQueryKey(), staleTime: 300_000 } });
  const amount = paymentConfig.data?.amount ?? 10500;

  const doLookup = () => {
    const normalized = lookupInput.trim().toUpperCase();
    if (normalized.length < 3) {
      setLookupMessage('Enter at least 3 characters from your staff ID.');
      return;
    }
    setLookupMessage('');
    lookupQuery.refetch().then((response) => {
      if (response.error) {
        setLookupMessage('We could not complete the lookup. Check the staff ID and try again.');
        return;
      }
      const result = response.data;
      if (result) {
        setLookup(result);
        if (result.found) {
          setStaffId(result.staffId);
          setDetails((previous) => ({ ...previous, name: result.name }));
        } else {
          setLookupMessage('No matching staff record was found. Confirm the ID with your employer and try again.');
        }
      }
    });
  };

  const validateSecurity = () => {
    const next: Record<string, string> = {};
    if (verificationValue.trim().length < 10) next.verificationValue = 'Enter the 10 or 11 digit value used for verification.';
    setErrors(next);
    if (!Object.keys(next).length) setStep(2);
  };
  const validateDetails = () => {
    const next: Record<string, string> = {};
    if (details.name.trim().length < 2) next.name = 'Enter your full name.';
    if (details.address.trim().length < 5) next.address = 'Enter your residential address.';
    if (details.phone.trim().length < 7) next.phone = 'Enter a valid phone number.';
    if (!/^\S+@\S+\.\S+$/.test(details.email)) next.email = 'Enter a valid email address.';
    if (!details.monthlySalary || Number(details.monthlySalary) < 0) next.monthlySalary = 'Enter your monthly salary.';
    if (details.nextOfKin.trim().length < 2) next.nextOfKin = 'Enter a next of kin.';
    setErrors(next);
    if (Object.keys(next).length) return;
    createSubmission.mutate({
      data: {
        staffId,
        name: details.name.trim(),
        address: details.address.trim(),
        phone: details.phone.trim(),
        email: details.email.trim(),
        monthlySalary: Number(details.monthlySalary),
        nextOfKin: details.nextOfKin.trim(),
        verificationType: verificationType as 'BVN' | 'NIN' | 'Bank account',
        verificationValue: verificationValue.trim(),
      },
    }, {
      onSuccess: (created) => {
        setSubmission(created);
        setCreatedMessage('Your details have been saved. Complete the one-time confirmation payment to send this for review.');
        setStep(3);
      },
      onError: () => setCreatedMessage('We could not save your details right now. Please review the form and try again.'),
    });
  };
  const startPayment = async () => {
    if (!submission) return;
    setPaymentMessage('');
    if (!paymentConfig.data?.publicKey) {
      setPaymentMessage('Paystack is not configured yet. Please contact the portal administrator.');
      return;
    }
    initializePayment.mutate({ id: submission.id }, {
      onSuccess: async (session) => {
        try {
          await loadPaystack();
          if (!window.PaystackPop) throw new Error('Paystack checkout unavailable');
          const checkout = window.PaystackPop.setup({
            key: paymentConfig.data!.publicKey,
            email: session.email,
            amount: session.amount * 100,
            currency: 'NGN',
            ref: `NHF-${submission.id}-${Date.now()}`,
            metadata: {
              custom_fields: [
                { display_name: 'Staff ID', variable_name: 'staff_id', value: session.staffId },
                { display_name: 'Applicant', variable_name: 'applicant', value: session.name },
              ],
            },
            onClose: () => setPaymentMessage('Payment window closed. You can try again whenever you are ready.'),
            callback: (response) => {
              setPaymentRef(response.reference);
              verifyPayment.mutate({ id: submission.id, data: { reference: response.reference } }, {
                onSuccess: (result) => {
                  setSubmission((previous) => previous ? { ...previous, paymentStatus: 'paid', status: 'payment_verified', paymentReference: result.reference } : previous);
                  setPaidConfirmed(true);
                  setPaymentMessage(result.message || 'Payment verified successfully.');
                },
                onError: () => setPaymentMessage('Paystack returned a payment reference, but verification could not be completed. Please contact support.'),
              });
            },
          });
          checkout.openIframe();
        } catch {
          setPaymentMessage('Paystack checkout could not be opened. Check your connection and try again.');
        }
      },
      onError: () => setPaymentMessage('Payment could not be initialized. Please try again.'),
    });
  };
  const confirmPayment = () => {
    if (!submission || paymentRef.trim().length < 3) {
      setPaymentMessage('Enter the payment reference before verifying.');
      return;
    }
    verifyPayment.mutate({ id: submission.id, data: { reference: paymentRef.trim() } }, {
      onSuccess: (result) => {
        setSubmission((previous) => previous ? { ...previous, paymentStatus: 'paid', status: 'payment_verified', paymentReference: result.reference } : previous);
        setPaidConfirmed(true);
        setPaymentMessage(result.message || 'Payment verified successfully.');
      },
      onError: () => setPaymentMessage('We could not verify this reference. Check it against your receipt and try again.'),
    });
  };
  const resetFlow = () => {
    setStep(0); setLookup(null); setLookupInput(''); setStaffId(''); setSubmission(null); setPaidConfirmed(false); setPaymentRef(''); setPaymentMessage(''); setCreatedMessage('');
    setDetails({ name: '', address: '', phone: '', email: '', monthlySalary: '', nextOfKin: '' });
  };

  return (
    <PortalShell>
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 max-w-2xl animate-rise-in">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9dafc] bg-[#edf4ff] px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-primary">
            <span className="size-1.5 rounded-full bg-accent" /> Applicant service
          </div>
          <h1 className="font-display text-3xl font-bold tracking-[-.045em] text-[#153b83] sm:text-5xl">Regularize your NHF record.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-base">A guided, secure way for Nigerian workers to update their details and continue their housing-loan journey.</p>
        </div>
        <StepProgress current={step} />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="animate-rise-in rounded-2xl border border-border bg-card p-5 shadow-[0_14px_35px_rgba(30,61,110,.06)] sm:p-8">
            {step === 0 && (
              <div data-testid="step-identify">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-primary">Step 1 of 4</p><h2 className="font-display text-2xl font-bold tracking-[-.03em]">Let’s find your staff record</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use the staff ID connected to your employment record. We use it only to locate your existing NHF profile.</p></div>
                  <div className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-[#edf4ff] text-primary sm:grid"><Search size={21} /></div>
                </div>
                <div className="max-w-lg">
                  <Field label="Staff ID" name="staffId" value={lookupInput} onChange={(event) => setLookupInput(event.target.value)} placeholder="e.g. FMBN-20481" hint="This can be found on your NHF statement or through your employer’s HR desk." data-testid="input-staff-id" autoComplete="off" />
                  {lookupMessage && <p className="mt-2 text-sm font-medium text-red-600" data-testid="error-staff-lookup">{lookupMessage}</p>}
                  {lookup && lookup.found && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="status-staff-found">
                      <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={18} /></span><div><p className="text-sm font-bold text-emerald-900">{lookup.name}</p><p className="text-xs text-emerald-700">Staff ID {lookup.staffId} found. Ready for security check.</p></div></div>
                    </div>
                  )}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Button type="button" onClick={doLookup} disabled={lookupQuery.isFetching} data-testid="button-lookup-staff">{lookupQuery.isFetching ? <><RefreshCw size={16} className="animate-spin" /> Searching</> : <><Search size={16} /> Find my record</>}</Button>
                    {lookup?.found && <Button type="button" variant="secondary" onClick={() => setStep(1)} data-testid="button-continue-security">Continue <ArrowRight size={16} /></Button>}
                  </div>
                </div>
              </div>
            )}
            {step === 1 && (
              <div data-testid="step-security">
                <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-primary">Step 2 of 4</p><h2 className="font-display text-2xl font-bold tracking-[-.03em]">Confirm it’s you</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose one identity detail already linked to your NHF record. Your value is encrypted and never displayed in full.</p></div>
                <div className="grid gap-5 sm:max-w-lg">
                  <SelectField label="Verification method" value={verificationType} onChange={setVerificationType} testId="select-verification-type" options={[{ value: 'BVN', label: 'Bank Verification Number (BVN)' }, { value: 'NIN', label: 'National Identification Number (NIN)' }, { value: 'Bank account', label: 'Bank account number' }]} />
                  <Field label={`${verificationType} number`} name="verificationValue" type="password" inputMode="numeric" value={verificationValue} onChange={(event) => setVerificationValue(event.target.value)} placeholder="Enter your verification number" error={errors.verificationValue} data-testid="input-verification-value" />
                  <Notice><span>Only the last four digits will appear on your application record.</span></Notice>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" onClick={() => setStep(0)} data-testid="button-back-identify"><ArrowLeft size={16} /> Back</Button><Button type="button" onClick={validateSecurity} data-testid="button-continue-details">Confirm and continue <ArrowRight size={16} /></Button></div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div data-testid="step-details">
                <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-primary">Step 3 of 4</p><h2 className="font-display text-2xl font-bold tracking-[-.03em]">Complete your details</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Make sure these details match the documents you use for your housing-loan application.</p></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" name="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="As shown on official records" error={errors.name} data-testid="input-full-name" />
                  <Field label="Phone number" name="phone" type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} placeholder="+234 800 000 0000" error={errors.phone} data-testid="input-phone" />
                  <div className="sm:col-span-2"><Field label="Email address" name="email" type="email" value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} placeholder="you@example.com" hint="We’ll send your confirmation and review updates here." error={errors.email} data-testid="input-email" /></div>
                  <div className="sm:col-span-2"><Field label="Residential address" name="address" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} placeholder="House number, street, city, state" error={errors.address} data-testid="input-address" /></div>
                   <Field label="Monthly salary (Naira)" name="monthlySalary" type="number" min="0" step="100" inputMode="numeric" value={details.monthlySalary} onChange={(e) => setDetails({ ...details, monthlySalary: e.target.value })} placeholder="250000" hint="Enter the full amount in naira without commas. Example: ₦250,000 → type 250000." error={errors.monthlySalary} data-testid="input-monthly-salary" />
                  <Field label="Next of kin" name="nextOfKin" value={details.nextOfKin} onChange={(e) => setDetails({ ...details, nextOfKin: e.target.value })} placeholder="Full name" error={errors.nextOfKin} data-testid="input-next-of-kin" />
                </div>
                {createdMessage && <p className="mt-4 text-sm text-red-600" data-testid="status-submission-error">{createdMessage}</p>}
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" onClick={() => setStep(1)} data-testid="button-back-security"><ArrowLeft size={16} /> Back</Button><Button type="button" onClick={validateDetails} disabled={createSubmission.isPending} data-testid="button-save-details">{createSubmission.isPending ? <><RefreshCw size={16} className="animate-spin" /> Saving details</> : <>Save and continue <ArrowRight size={16} /></>}</Button></div>
              </div>
            )}
            {step === 3 && (
              <div data-testid="step-payment">
                {!paidConfirmed ? (
                  <>
                    <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-primary">Step 4 of 4</p><h2 className="font-display text-2xl font-bold tracking-[-.03em]">Complete your confirmation</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">A single confirmation fee sends your regularization request to the review desk.</p></div>
                    {createdMessage && <Notice tone="success"><span>{createdMessage}</span></Notice>}
                    <div className="my-6 rounded-2xl border border-[#c9dafc] bg-[#f4f8ff] p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-primary">Confirmation fee</p><p className="mt-1 font-display text-4xl font-bold tracking-[-.05em] text-[#153b83]" data-testid="text-payment-amount">{money.format(amount)}</p></div><span className="grid size-11 place-items-center rounded-xl bg-card text-primary shadow-sm"><Banknote size={21} /></span></div>
                      <div className="mt-5 grid gap-2 border-t border-[#d9e5fa] pt-4 text-sm sm:grid-cols-2"><div className="flex justify-between gap-2"><span className="text-muted-foreground">Applicant</span><strong>{submission?.name}</strong></div><div className="flex justify-between gap-2"><span className="text-muted-foreground">Staff ID</span><strong>{submission?.staffId}</strong></div></div>
                    </div>
                     <Notice><span>Payments are processed securely by Paystack. Do not share your BVN, NIN, or card PIN with anyone claiming to represent NHF.</span></Notice>
                     {paymentConfig.isError && <Notice tone="error"><span>Paystack is temporarily unavailable. Please refresh this page and try again. If the problem continues, contact the portal administrator.</span></Notice>}
                     {!paymentConfig.isLoading && !paymentConfig.isError && !paymentConfig.data?.publicKey && <Notice tone="error"><span>Paystack has not been configured for this portal yet. Please contact the portal administrator.</span></Notice>}
                    {paymentMessage && <p className={cn('mt-4 text-sm font-medium', paymentMessage.includes('successfully') || paymentMessage.includes('ready') ? 'text-emerald-700' : 'text-red-600')} data-testid="status-payment-message">{paymentMessage}</p>}
                     <div className="mt-6 flex flex-col gap-4">
                       <Button type="button" onClick={startPayment} disabled={paymentConfig.isLoading || paymentConfig.isError || !paymentConfig.data?.publicKey || initializePayment.isPending || verifyPayment.isPending} data-testid="button-initialize-payment">{paymentConfig.isLoading || initializePayment.isPending || verifyPayment.isPending ? <><RefreshCw size={16} className="animate-spin" /> {verifyPayment.isPending ? 'Verifying payment' : 'Opening Paystack'}</> : <><Banknote size={16} /> Pay securely with Paystack</>}</Button>
                       <div className="rounded-xl border border-dashed border-border bg-background p-3 text-xs leading-5 text-muted-foreground">After payment, Paystack will return you to this page and verify the transaction automatically.</div>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center" data-testid="status-payment-verified">
                    <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34} /></span>
                    <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Payment verified</p>
                    <h2 className="mt-2 font-display text-3xl font-bold tracking-[-.04em] text-[#153b83]">Your request is in review.</h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">We’ve received your regularization details and payment. Keep this reference for your records.</p>
                    <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border bg-secondary p-4 text-left"><div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Reference</span><span className="font-mono font-semibold" data-testid="text-payment-reference">{submission?.paymentReference || paymentRef}</span></div><div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Status</span><span className="font-semibold text-emerald-700">Payment verified</span></div></div>
                    <Button type="button" variant="secondary" className="mt-7" onClick={resetFlow} data-testid="button-start-new-application">Start another application</Button>
                  </div>
                )}
              </div>
            )}
          </section>
          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-2xl bg-[#153b83] p-5 text-white shadow-[0_14px_35px_rgba(21,59,131,.16)]"><div className="mb-8 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#b8cdf9]">Your journey</span><Activity size={18} className="text-[#83e9dc]" /></div><p className="font-display text-2xl font-semibold leading-tight">Clear steps.<br />No guesswork.</p><p className="mt-3 text-sm leading-6 text-[#c8d6f2]">Your progress is saved as you move through the portal.</p><div className="mt-8 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#83e9dc] transition-all duration-500" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div><p className="mt-2 text-right text-xs text-[#b8cdf9]">{step + 1} of 4</p></div>
            <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className="text-accent" /> Need help?</div><p className="mt-2 text-sm leading-6 text-muted-foreground">Contact your employer’s HR desk or the FMBN helpdesk if you can’t find your staff ID.</p><div className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary"><Phone size={15} /> 0700-CALL-FMBN</div></div>
          </aside>
        </div>
      </main>
    </PortalShell>
  );
}

function MetricCard({ label, value, accent, icon: Icon }: { label: string; value: number; accent: string; icon: typeof UsersRound }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_10px_25px_rgba(30,61,110,.04)] sm:p-5"><div className="flex items-start justify-between gap-3"><span className={cn('grid size-9 place-items-center rounded-xl', accent)}><Icon size={17} /></span><span className="text-xs font-medium text-muted-foreground">Live</span></div><p className="mt-5 font-display text-3xl font-bold tracking-[-.04em]" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>;
}

function StatusPill({ status, paymentStatus }: { status: string; paymentStatus?: string }) {
  const value = paymentStatus === 'paid' && status === 'pending' ? 'payment_verified' : status;
  const classes: Record<string, string> = { pending: 'bg-amber-50 text-amber-700 border-amber-200', payment_verified: 'bg-[#edf4ff] text-primary border-[#c9dafc]', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200', rejected: 'bg-red-50 text-red-700 border-red-200' };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold', classes[value] || 'bg-secondary text-muted-foreground border-border')} data-testid={`status-${value}`}><span className="mr-1.5 size-1.5 rounded-full bg-current" />{statusText[value] || value}</span>;
}

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({ status: statusFilter === 'all' ? undefined : statusFilter as 'pending' | 'payment_verified' | 'approved' | 'rejected', search: search.trim() || undefined }), [statusFilter, search]);
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), staleTime: 30_000 } });
  const submissions = useListSubmissions(params, { query: { queryKey: getListSubmissionsQueryKey(params), staleTime: 30_000 } });
  const detail = useGetSubmission(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetSubmissionQueryKey(selectedId ?? 0) } });
  const markPaid = useMarkSubmissionPaid();
  const approve = useApproveSubmission();
  const updateSubmission = useUpdateSubmission();
  const paymentConfig = useGetPaymentConfig({ query: { queryKey: getGetPaymentConfigQueryKey(), staleTime: 300_000 } });
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');

  const refreshAdmin = () => {
    queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey(params) });
    queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
    if (selectedId !== null) queryClient.invalidateQueries({ queryKey: getGetSubmissionQueryKey(selectedId) });
  };
  const doMarkPaid = (id: number) => {
    markPaid.mutate({ id }, { onSuccess: () => { setToast('Payment marked as received.'); refreshAdmin(); }, onError: () => setToast('Could not mark this submission as paid.') });
  };
  const doApprove = (id: number) => {
    approve.mutate({ id }, { onSuccess: () => { setToast('Submission approved and applicant notified.'); refreshAdmin(); }, onError: () => setToast('Approval could not be completed.') });
  };
  const beginEdit = () => { if (detail.data) { setEditName(detail.data.name); setEditMode(true); } };
  const saveEdit = () => {
    if (!selectedId || editName.trim().length < 2) return;
    updateSubmission.mutate({ id: selectedId, data: { name: editName.trim() } }, { onSuccess: () => { setToast('Applicant details updated.'); setEditMode(false); refreshAdmin(); }, onError: () => setToast('Could not save the applicant details.') });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <TopBar admin />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-primary">Internal review desk</p><h1 className="font-display text-3xl font-bold tracking-[-.045em] text-[#153b83] sm:text-4xl">Submission overview</h1><p className="mt-2 text-sm text-muted-foreground">Review and action regularization requests from the NHF applicant portal.</p></div><div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Activity size={14} className="text-accent" /> Fee configured at <strong className="text-foreground">{money.format(paymentConfig.data?.amount ?? 10500)}</strong></div></div>
        {summary.isError || submissions.isError ? <Notice tone="error"><div className="flex flex-wrap items-center justify-between gap-3"><span>We could not load the review desk data.</span><Button variant="danger" onClick={() => { summary.refetch(); submissions.refetch(); }} data-testid="button-retry-admin"><RefreshCw size={15} /> Retry</Button></div></Notice> : null}
        {summary.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="skeleton h-32 rounded-2xl" key={item} />)}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total submissions" value={summary.data?.totalSubmissions ?? 0} accent="bg-[#e7efff] text-primary" icon={UsersRound} /><MetricCard label="Pending review" value={summary.data?.pendingReview ?? 0} accent="bg-amber-100 text-amber-700" icon={Clock3} /><MetricCard label="Payment verified" value={summary.data?.paymentVerified ?? 0} accent="bg-[#dff8f5] text-[#087c73]" icon={BadgeCheck} /><MetricCard label="Approved" value={summary.data?.approved ?? 0} accent="bg-emerald-100 text-emerald-700" icon={ClipboardCheck} /></div>}
        <section className="mt-7 rounded-2xl border border-border bg-card shadow-[0_14px_35px_rgba(30,61,110,.05)]">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-display text-lg font-bold">Applications</h2><p className="mt-1 text-xs text-muted-foreground">Open a row to inspect, edit, or complete a review action.</p></div><div className="flex flex-col gap-3 sm:flex-row"><label className="relative block"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or staff ID" data-testid="input-admin-search" className="focus-ring min-h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-56" /></label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-admin-status" className="focus-ring min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"><option value="all">All statuses</option><option value="pending">Awaiting review</option><option value="payment_verified">Payment verified</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div></div>
          {submissions.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div className="skeleton h-16 rounded-xl" key={item} />)}</div> : (submissions.data?.length ?? 0) === 0 ? <div className="p-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><FileCheck2 size={22} /></span><h3 className="mt-4 font-display font-bold">No matching applications</h3><p className="mt-1 text-sm text-muted-foreground">Try another search or clear the status filter.</p><Button variant="secondary" className="mt-5" onClick={() => { setSearch(''); setStatusFilter('all'); }} data-testid="button-clear-filters">Clear filters</Button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border bg-[#f8faff] text-[11px] uppercase tracking-[.1em] text-muted-foreground"><th className="px-5 py-3 font-bold">Applicant</th><th className="px-5 py-3 font-bold">Verification</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 font-bold">Received</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead><tbody>{submissions.data?.map((item) => <tr key={item.id} className="border-b border-border last:border-0 hover:bg-[#fbfcff]" data-testid={`row-submission-${item.id}`}><td className="px-5 py-4"><button type="button" onClick={() => setSelectedId(item.id)} data-testid={`button-open-submission-${item.id}`} className="text-left"><p className="font-semibold text-[#153b83] hover:underline">{item.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.staffId}</p></button></td><td className="px-5 py-4"><p className="text-sm font-medium">{item.verificationType}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.verificationMasked || 'Protected'}</p></td><td className="px-5 py-4"><StatusPill status={item.status} paymentStatus={item.paymentStatus} /><p className="mt-1.5 text-xs text-muted-foreground">{item.paymentStatus === 'paid' ? 'Paid' : 'Payment not received'}</p></td><td className="px-5 py-4 text-sm text-muted-foreground">{dateTime.format(new Date(item.createdAt))}</td><td className="px-5 py-4 text-right"><Button variant="ghost" className="min-h-9 px-2" onClick={() => setSelectedId(item.id)} data-testid={`button-view-submission-${item.id}`}><MoreHorizontal size={18} /></Button></td></tr>)}</tbody></table></div>}
        </section>
        <section className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">The latest changes across submissions.</p></div><Bell size={18} className="text-primary" /></div><div className="mt-5 space-y-4">{(summary.data?.recentActivity?.length ?? 0) === 0 ? <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">No recent activity to show.</p> : summary.data?.recentActivity?.slice(0, 4).map((activity) => <div className="flex gap-3" key={activity.id}><span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-[#edf4ff] text-primary"><Activity size={14} /></span><div><p className="text-sm font-semibold">{activity.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{activity.detail}</p><p className="mt-1 text-[11px] text-muted-foreground">{dateTime.format(new Date(activity.createdAt))}</p></div></div>)}</div></div><div className="rounded-2xl bg-[#153b83] p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#b8cdf9]">Review principle</p><h2 className="mt-4 font-display text-2xl font-bold leading-tight">Payment first.<br />Approval second.</h2><p className="mt-3 text-sm leading-6 text-[#c8d6f2]">An application can only be approved after a successful payment verification. This keeps the review queue clear and auditable.</p></div></section>
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[#153b83] px-4 py-3 text-sm font-medium text-white shadow-xl" data-testid="status-admin-toast"><CheckCircle2 size={17} className="text-[#83e9dc]" />{toast}<button type="button" onClick={() => setToast('')} data-testid="button-dismiss-toast"><X size={15} /></button></div>}
      {selectedId !== null && <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#102754]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-label="Submission details" data-testid="dialog-submission-details"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-primary">Submission review</p><h2 className="mt-1 font-display text-xl font-bold">{detail.data?.name || 'Loading submission'}</h2></div><Button variant="ghost" className="min-h-9 px-2" onClick={() => { setSelectedId(null); setEditMode(false); }} data-testid="button-close-details"><X size={18} /></Button></div>{detail.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-14 rounded-xl" /><div className="skeleton h-28 rounded-xl" /><div className="skeleton h-14 rounded-xl" /></div> : detail.isError || !detail.data ? <div className="p-8 text-center"><XCircle className="mx-auto text-red-500" /><p className="mt-3 text-sm text-muted-foreground">This submission could not be loaded.</p></div> : <div className="p-5"><div className="flex flex-wrap items-center gap-2"><StatusPill status={detail.data.status} paymentStatus={detail.data.paymentStatus} /><span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', detail.data.paymentStatus === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-secondary text-muted-foreground')}>{detail.data.paymentStatus === 'paid' ? 'Payment received' : statusText[detail.data.paymentStatus] || detail.data.paymentStatus}</span></div><div className="mt-5 grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">{[['Staff ID', detail.data.staffId], ['Email', detail.data.email], ['Phone', detail.data.phone], ['Verification', `${detail.data.verificationType} · ${detail.data.verificationMasked || 'Protected'}`], ['Monthly salary', detail.data.monthlySalary ? `₦${salaryAmount.format(detail.data.monthlySalary)}` : 'Not provided'], ['Next of kin', detail.data.nextOfKin || 'Not provided'], ['Received', dateTime.format(new Date(detail.data.createdAt))], ['Payment reference', detail.data.paymentReference || 'Not available']].map(([label, value]) => <div key={label}><p className="text-[11px] uppercase tracking-[.08em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold" data-testid={`detail-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p></div>)}</div><div className="mt-3 rounded-xl border border-border bg-background p-4"><p className="text-[11px] uppercase tracking-[.08em] text-muted-foreground">Address</p><p className="mt-1 text-sm font-semibold">{detail.data.address || 'Not provided'}</p></div>{editMode ? <div className="mt-5 rounded-xl border border-[#c9dafc] bg-[#f4f8ff] p-4"><Field label="Applicant name" name="editName" value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-name" /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditMode(false)} data-testid="button-cancel-edit">Cancel</Button><Button onClick={saveEdit} disabled={updateSubmission.isPending} data-testid="button-save-edit">{updateSubmission.isPending ? 'Saving' : 'Save changes'}</Button></div></div> : <div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={beginEdit} data-testid="button-edit-submission"><FileText size={16} /> Edit details</Button>{detail.data.paymentStatus !== 'paid' && <Button variant="secondary" onClick={() => doMarkPaid(detail.data!.id)} disabled={markPaid.isPending} data-testid="button-mark-paid"><Banknote size={16} /> Mark payment received</Button>}<Button onClick={() => doApprove(detail.data!.id)} disabled={detail.data.paymentStatus !== 'paid' || detail.data.status === 'approved' || approve.isPending} data-testid="button-approve-submission"><CheckCircle2 size={16} /> {detail.data.status === 'approved' ? 'Approved' : detail.data.paymentStatus !== 'paid' ? 'Verify payment to approve' : 'Approve submission'}</Button></div>}<p className="mt-4 text-xs text-muted-foreground">Approval sends the applicant an update through their registered notification channel.</p></div>}</div></div>}
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={ApplicantPortal} /><Route path="/admin" component={AdminDashboard} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;