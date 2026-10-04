// Calculator limits for the landing page. Prices and the math behind them live in the backend's pricing module.
export { MINIMUM_TOP_UP, estimateTopUp, formatMoney, type Usage } from "@FindPhotosOfMe/backend/convex/pricing";

export const LIMITS = {
  photos: { min: 100, max: 20_000, step: 100 },
  searches: { min: 50, max: 5_000, step: 50 },
} as const;

/** Rounds a typed count to the nearest step inside its limits. */
export function clampCount(value: number, kind: keyof typeof LIMITS) {
  const { min, max, step } = LIMITS[kind];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

export const count = new Intl.NumberFormat("en-US");
