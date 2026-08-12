// Single source of truth for the reader's cookie/analytics choice, set by the
// ConsentBanner and stored in localStorage. First-party analytics is opt-out:
// EVERYTHING that records reader behavior (event beacons, reading logs, view
// counts driven by the client) must respect a 'declined' choice, or the opt-out
// is only half real.
export const CONSENT_KEY = 'rsnews_consent';

/** True when the reader has explicitly declined analytics. Safe on the server. */
export function analyticsDeclined(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CONSENT_KEY) === 'declined';
  } catch {
    return false;
  }
}
