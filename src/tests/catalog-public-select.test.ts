import { describe, expect, it } from "vitest";
import { publicProductSelect } from "@/lib/catalog";

describe("publicProductSelect", () => {
  it("does not expose internal cost fields", () => {
    expect("costCents" in publicProductSelect).toBe(false);
  });

  it("keeps the public catalog fields needed by storefront and product pages", () => {
    expect(publicProductSelect).toMatchObject({
      id: true,
      slug: true,
      nameFr: true,
      nameEn: true,
      descriptionFr: true,
      descriptionEn: true,
      imageUrl: true,
      priceCents: true,
      currency: true,
      stock: true,
      isSubscription: true,
      priceWeekly: true,
      priceBiweekly: true,
      priceMonthly: true,
      priceQuarterly: true,
      categoryId: true,
    });
  });
});
