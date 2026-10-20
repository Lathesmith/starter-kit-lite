/** Unix time in seconds. Everything in the database uses this. */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Start of the current UTC month, in Unix seconds. Used for monthly quotas. */
export function startOfMonth(ts = now()): number {
  const d = new Date(ts * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

/**
 * Start of the next UTC month, in Unix seconds. Computed from the calendar month, not by adding
 * days: "now + 32 days" from January 31 lands in March and would skip February.
 */
export function startOfNextMonth(ts = now()): number {
  const d = new Date(ts * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
