// The one place prices live: the landing calculator, top-up checkout, and balance charges all read these.
// Money is counted in mills, thousandths of a dollar, so a $0.005 photo is a whole number.

export const MILLS_PER_DOLLAR = 1_000;

/** What each thing costs, in mills. Storage is per GB for each 30 days beyond the included time. */
export const PRICES = { photo: 5, search: 15, storageGbMonth: 100 } as const;

export const MINIMUM_TOP_UP = 10 * MILLS_PER_DOLLAR;
export const MAXIMUM_TOP_UP = 1_000 * MILLS_PER_DOLLAR;
/** New accounts can try 500 photos and 50 searches. */
export const TRIAL_CREDIT = 500 * PRICES.photo + 50 * PRICES.search;

export const DAY = 24 * 60 * 60 * 1000;
/** How long a gallery stays online after it's created, and how much each paid extension adds. */
export const INCLUDED_DAYS = 30;
export const TRIAL_DAYS = 7;
export const EXTENSION_DAYS = 30;

/** Calculator estimates assume an average photo of this size. */
export const PHOTO_BYTES = 5e6;

export type Usage = { photos: number; searches: number; days: 30 | 90 };

/** What the calculator's choices cost, in mills. */
export function estimateTopUp({ photos, searches, days }: Usage) {
  const photoCost = photos * PRICES.photo;
  const searchCost = searches * PRICES.search;
  const storageCost = storageExtensionCost(photos * PHOTO_BYTES) * (days / EXTENSION_DAYS - 1);
  const subtotal = photoCost + searchCost + storageCost;
  return { photoCost, searchCost, storageCost, subtotal, total: Math.max(MINIMUM_TOP_UP, subtotal) };
}

/** What keeping this many bytes online for another 30 days costs, rounded up to a whole cent. */
export function storageExtensionCost(bytes: number) {
  return Math.ceil((bytes / 1e9) * PRICES.storageGbMonth / 10) * 10;
}

/** What keeping a gallery online for another 30 days costs. Galleries from before sizes were recorded are estimated. */
export function extensionCost(gallery: { storedBytes?: number; imagesCount: number }) {
  return storageExtensionCost(gallery.storedBytes ?? gallery.imagesCount * PHOTO_BYTES);
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
