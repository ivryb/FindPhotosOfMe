// The one place prices live: the landing calculator, top-up checkout, and balance charges all read these.
// Money is counted in mills, thousandths of a dollar, so a $0.002 photo is a whole number.

export const MILLS_PER_DOLLAR = 1_000;

/** What each thing costs, in mills. Storage is per GB for each 30 days beyond the included time, charged by the day. */
export const PRICES = { photo: 2, search: 10, storageGbMonth: 50 } as const;
const MONTH_DAYS = 30;

export const MINIMUM_TOP_UP = 10 * MILLS_PER_DOLLAR;
export const MAXIMUM_TOP_UP = 1_000 * MILLS_PER_DOLLAR;
/** What new accounts can try for free, given to them as credit. */
export const TRIAL = { photos: 1_000, searches: 50 } as const;
export const TRIAL_CREDIT = TRIAL.photos * PRICES.photo + TRIAL.searches * PRICES.search;

export const DAY = 24 * 60 * 60 * 1000;
/** How long a gallery stays online after it's created without paying for storage; the owner can keep it online longer. */
export const INCLUDED_DAYS = 30;
export const TRIAL_DAYS = 7;

/** Calculator estimates assume an average photo of this size. */
export const PHOTO_BYTES = 5e6;

/** What someone expects to use: photos, searches, and how many days to keep the photos online. */
export type Usage = { photos: number; searches: number; days: number };

/** What the calculator's choices cost, in mills. Storage beyond the included days is rounded up to a whole cent. */
export function estimateTopUp({ photos, searches, days }: Usage) {
  const photoCost = photos * PRICES.photo;
  const searchCost = searches * PRICES.search;
  const extraMonths = Math.max(0, days - INCLUDED_DAYS) / MONTH_DAYS;
  const storageCost = Math.ceil(((photos * PHOTO_BYTES) / 1e9) * PRICES.storageGbMonth * extraMonths / 10) * 10;
  const subtotal = photoCost + searchCost + storageCost;
  return { photoCost, searchCost, storageCost, subtotal, total: Math.max(MINIMUM_TOP_UP, subtotal) };
}

/**
 * What one more day online costs a gallery past its included time, to the nearest mill, so a tiny gallery can cost
 * nothing. Galleries from before sizes were recorded are estimated.
 */
export function dailyStorageCost(gallery: { storedBytes?: number; imagesCount: number }) {
  const bytes = gallery.storedBytes ?? gallery.imagesCount * PHOTO_BYTES;
  return Math.round(((bytes / 1e9) * PRICES.storageGbMonth) / MONTH_DAYS);
}

/** How many photos or searches a balance pays for. */
export function coveredBy(credit: number, item: "photo" | "search") {
  return Math.max(0, Math.floor(credit / PRICES[item]));
}

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  trailingZeroDisplay: "stripIfInteger",
  roundingMode: "trunc",
});

/** Formats mills as dollars. Partial cents are dropped, so a balance never looks larger than it is. */
export function formatMoney(mills: number) {
  return dollars.format(mills / MILLS_PER_DOLLAR);
}
