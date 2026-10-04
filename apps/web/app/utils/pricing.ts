// Draft pay-as-you-go rates for the pricing preview, independent of checkout.
// Storage assumes 5 MB per photo; the first 30 days are included, then each extra 30 days costs $0.10/GB.

export type Usage = { photos: number; searches: number; days: 30 | 90 };

export const MINIMUM_PAYMENT = 10;
export const LIMITS = {
  photos: { min: 100, max: 20_000, step: 100 },
  searches: { min: 50, max: 5_000, step: 50 },
} as const;

export function estimatePrice({ photos, searches, days }: Usage) {
  const storageGb = photos * 5 / 1_000;
  const photoCost = photos * 0.005;
  const searchCost = searches * 0.015;
  const storageCost = storageGb * 0.1 * (days / 30 - 1);
  const subtotal = photoCost + searchCost + storageCost;
  return { storageGb, photoCost, searchCost, storageCost, subtotal, total: Math.max(MINIMUM_PAYMENT, subtotal) };
}

/** Rounds a typed count to the nearest step inside its limits. */
export function clampCount(value: number, kind: keyof typeof LIMITS) {
  const { min, max, step } = LIMITS[kind];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, trailingZeroDisplay: "stripIfInteger" });
export const count = new Intl.NumberFormat("en-US");
