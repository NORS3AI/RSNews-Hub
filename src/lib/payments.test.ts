import { describe, it, expect } from 'vitest';
import { isPaid, paidTotalCents, parseAmountToCents, normalizePaymentStatus } from './payments';

describe('isPaid', () => {
  it('is true only when a PAID payment exists', () => {
    expect(isPaid([])).toBe(false);
    expect(isPaid([{ status: 'PENDING', amountCents: 100 }])).toBe(false);
    expect(isPaid([{ status: 'PENDING', amountCents: 100 }, { status: 'PAID', amountCents: 200 }])).toBe(true);
    expect(isPaid([{ status: 'REFUNDED', amountCents: 100 }])).toBe(false);
  });
});

describe('paidTotalCents', () => {
  it('sums only PAID payments', () => {
    expect(paidTotalCents([{ status: 'PAID', amountCents: 30000 }, { status: 'PENDING', amountCents: 500 }, { status: 'PAID', amountCents: 1200 }])).toBe(31200);
  });
});

describe('parseAmountToCents', () => {
  it('parses numbers, currency strings, and thousands separators', () => {
    expect(parseAmountToCents(300)).toBe(30000);
    expect(parseAmountToCents('300.00')).toBe(30000);
    expect(parseAmountToCents('$300')).toBe(30000);
    expect(parseAmountToCents('1,200.50')).toBe(120050);
    expect(parseAmountToCents('300.00 USD')).toBe(30000);
    expect(parseAmountToCents('')).toBe(0);
    expect(parseAmountToCents('free')).toBe(0);
    expect(parseAmountToCents(null)).toBe(0);
  });
});

describe('normalizePaymentStatus', () => {
  it('maps provider status strings to our vocabulary', () => {
    expect(normalizePaymentStatus('Completed')).toBe('PAID');
    expect(normalizePaymentStatus('paid')).toBe('PAID');
    expect(normalizePaymentStatus('captured')).toBe('PAID');
    expect(normalizePaymentStatus('pending')).toBe('PENDING');
    expect(normalizePaymentStatus('refunded')).toBe('REFUNDED');
    expect(normalizePaymentStatus('declined')).toBe('FAILED');
    expect(normalizePaymentStatus('')).toBe('PAID'); // a recorded payment with no status is treated as paid
    expect(normalizePaymentStatus('weird')).toBe('PENDING');
  });
});
