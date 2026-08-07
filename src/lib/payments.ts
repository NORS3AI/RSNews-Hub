// Payment CONFIRMATION for ad campaigns. No money moves through the hub — all
// paying happens on JotForm. This records whether a campaign's payment has been
// confirmed (JotForm reports it on the submission, or an admin confirms it), and
// a campaign can't go live (schedule a flight) until it is.
//
// Pure helpers (isPaid, parseAmountToCents) are unit-tested; the rest are thin
// DB writes that dedup on the provider's transaction id.

import type { Prisma } from '@prisma/client';
import { prisma } from './db';

type Db = Prisma.TransactionClient | typeof prisma;

export type PaymentLike = { status: string; amountCents: number };

/**
 * Whether a confirmed payment is required before a campaign can go live. Off by
 * default — no money crosses the hub, so an admin approves/activates ads without
 * a payment gate. Set ADS_REQUIRE_PAYMENT=true to re-enable the confirmation gate.
 */
export function paymentRequired(): boolean {
  // Accept common truthy spellings so an operator re-enabling the gate can't
  // accidentally leave it off (fail-open) with ADS_REQUIRE_PAYMENT=1/yes/on.
  return /^(1|true|yes|on)$/i.test((process.env.ADS_REQUIRE_PAYMENT || '').trim());
}

/** Is this campaign settled? True if any of its payments is PAID. */
export function isPaid(payments: PaymentLike[]): boolean {
  return payments.some((p) => p.status === 'PAID');
}

/** Total of PAID payments, in cents. */
export function paidTotalCents(payments: PaymentLike[]): number {
  return payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + (p.amountCents || 0), 0);
}

/** Parse a money value ("$300", "300.00", "1,200.50", 300) to integer cents. */
export function parseAmountToCents(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v * 100);
  if (typeof v !== 'string') return 0;
  const cleaned = v.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return isFinite(n) ? Math.round(n * 100) : 0;
}

/** Normalize a provider status string to our PAID | PENDING | REFUNDED | FAILED. */
export function normalizePaymentStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (/paid|complete|success|settle|captur/.test(s)) return 'PAID';
  if (/refund/.test(s)) return 'REFUNDED';
  if (/fail|declin|error|void/.test(s)) return 'FAILED';
  if (/pend|await|process/.test(s)) return 'PENDING';
  return s ? 'PENDING' : 'PAID'; // no status given → treat a recorded payment as paid
}

export type RecordPaymentInput = {
  campaignId?: string; vendorId?: string; submissionId?: string;
  provider?: string; externalId?: string; amountCents?: number; currency?: string; status?: string; note?: string;
};

/** Record a payment, deduped on `externalId` when present. Never double-records. */
export async function recordPayment(input: RecordPaymentInput, db: Db = prisma): Promise<void> {
  if (input.externalId) {
    const existing = await db.payment.findUnique({ where: { externalId: input.externalId }, select: { id: true } });
    if (existing) return;
  }
  await db.payment.create({
    data: {
      campaignId: input.campaignId ?? null,
      vendorId: input.vendorId ?? null,
      submissionId: input.submissionId ?? null,
      provider: input.provider ?? 'manual',
      externalId: input.externalId ?? null,
      amountCents: input.amountCents ?? 0,
      currency: (input.currency ?? 'usd').toLowerCase(),
      status: input.status ?? 'PAID',
      note: input.note ?? null,
    },
  });
}

/** Admin: mark a campaign paid manually (comped / offline payment). */
export async function markCampaignPaid(campaignId: string, amountCents = 0, note?: string): Promise<void> {
  const campaign = await prisma.adCampaign.findUnique({ where: { id: campaignId }, select: { vendorId: true } });
  await recordPayment({ campaignId, vendorId: campaign?.vendorId ?? undefined, provider: 'manual', amountCents, status: 'PAID', note: note || 'Payment confirmed by admin' });
}

/** Whether a campaign has a settled payment (the go-live gate). */
export async function campaignIsPaid(campaignId: string): Promise<boolean> {
  const count = await prisma.payment.count({ where: { campaignId, status: 'PAID' } });
  return count > 0;
}
