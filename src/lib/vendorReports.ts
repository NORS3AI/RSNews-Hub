// Plain constants shared by server actions + pages. (Kept out of lib/actions,
// which is a 'use server' module and may only export async functions.)

export const AD_UPDATE_URL_KEY = 'vendor_ad_update_url';

/** Periods a vendor can request a performance report for → range in days. */
export const REPORT_PERIODS: Record<string, { label: string; days: number }> = {
  quarter: { label: 'Last quarter', days: 90 },
  '6mo': { label: 'Last 6 months', days: 180 },
  year: { label: 'Last 12 months', days: 365 },
  lifetime: { label: 'Lifetime', days: 3650 },
};
