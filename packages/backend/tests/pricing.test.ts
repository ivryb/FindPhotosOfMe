import { describe, expect, test } from "vitest";

import { MINIMUM_TOP_UP, PRICES, coveredBy, estimateTopUp, formatMoney, storageExtensionCost } from "../convex/pricing";

describe("estimateTopUp", () => {
  test("prices photos, searches, and extra storage time at calculator rates", () => {
    const price = estimateTopUp({ photos: 2_000, searches: 300, days: 90 });
    expect(price.photoCost).toBe(10_000); // $10
    expect(price.searchCost).toBe(4_500); // $4.50
    // 2,000 photos at 5 MB is 10 GB; two extra 30-day periods at $0.10/GB is $2
    expect(price.storageCost).toBe(2_000);
    expect(price.total).toBe(16_500);
  });

  test("tops a small purchase up to the minimum", () => {
    const price = estimateTopUp({ photos: 100, searches: 50, days: 30 });
    expect(price.subtotal).toBe(1_250);
    expect(price.total).toBe(MINIMUM_TOP_UP);
  });
});

describe("storageExtensionCost", () => {
  test("charges $0.10 per GB for another 30 days, rounded up to a whole cent", () => {
    expect(storageExtensionCost(15e9)).toBe(1_500);
    expect(storageExtensionCost(1)).toBe(10);
  });
});

describe("coveredBy", () => {
  test("says how many photos or searches a balance pays for", () => {
    expect(coveredBy(3_250, "photo")).toBe(650);
    expect(coveredBy(3_250, "search")).toBe(216);
    expect(coveredBy(-100, "photo")).toBe(0);
    expect(PRICES.photo).toBe(5);
  });
});

describe("formatMoney", () => {
  test("shows dollars and cents, dropping cents for whole dollars", () => {
    expect(formatMoney(10_000)).toBe("$10");
    expect(formatMoney(3_245)).toBe("$3.24");
    expect(formatMoney(-500)).toBe("-$0.50");
  });
});
