/**
 * Deterministic currency & payout helpers using integer basis points
 * to avoid IEEE-754 floating-point drift in wallet/bet calculations.
 */

export function sanitizeStake(raw: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sanitizeOdds(raw: unknown, fallback = 1.95): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return fallback;
  return Math.round(n * 100) / 100;
}

export function calculatePayout(stake: number, odds: number): number {
  const safeStake = Math.max(0, Math.round(Number(stake) || 0));
  const oddsBasis = Math.max(10000, Math.round((Number(odds) || 1.95) * 10000));
  return Math.round((safeStake * oddsBasis) / 10000);
}

/**
 * Deterministic bet cancellation deduction helper (default 2% fee, 98% refund).
 * Guarantees integer Rs. outputs where fee + refund === safeStake.
 */
export function calculateCancellationRefund(
  stake: number,
  feePercent = 2,
): { stake: number; fee: number; refund: number } {
  const safeStake = Math.max(0, Math.round(Number(stake) || 0));
  const clampedPct = Math.max(0, Math.min(100, Number(feePercent) || 0));
  const fee = Math.round((safeStake * clampedPct) / 100);
  const refund = Math.max(0, safeStake - fee);
  return { stake: safeStake, fee, refund };
}

