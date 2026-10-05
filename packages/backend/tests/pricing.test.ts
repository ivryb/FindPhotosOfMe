import { describe, expect, test } from "vitest";

import { MINIMUM_TOP_UP, PRICES, coveredBy, dailyStorageCost, estimateTopUp, formatMoney } from "../convex/pricing";

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

describe("dailyStorageCost", () => {
  test("charges $0.10 per GB for 30 days, split into days and rounded to the nearest mill", () => {
    expect(dailyStorageCost({ storedBytes: 30e9, imagesCount: 0 })).toBe(100);
    expect(dailyStorageCost({ storedBytes: 1e6, imagesCount: 0 })).toBe(0);
    // Galleries from before sizes were recorded are estimated at 5 MB a photo: 6,000 photos is 30 GB
    expect(dailyStorageCost({ imagesCount: 6_000 })).toBe(100);
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
