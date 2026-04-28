import { describe, expect, it } from "vitest";
import {
  getDisabledPromoCodes,
  getHiddenStorefrontProductSlugs,
  isPromoCodeBlockedForCheckout,
  isStorefrontProductHidden,
} from "@/lib/launch-guards";

describe("launch guards", () => {
  it("masque les slugs de produits de test du storefront", () => {
    expect(getHiddenStorefrontProductSlugs()).toEqual(
      expect.arrayContaining([
        "test",
        "testttt",
        "ptest",
      ]),
    );
    expect(isStorefrontProductHidden("test")).toBe(true);
    expect(isStorefrontProductHidden(" TESTTTT ")).toBe(true);
    expect(isStorefrontProductHidden(" ptest ")).toBe(true);
    expect(isStorefrontProductHidden(" croquettes-premium-bulldog ")).toBe(false);
    expect(isStorefrontProductHidden("croquettes-olive")).toBe(false);
  });

  it("bloque les codes promo de test au checkout", () => {
    expect(getDisabledPromoCodes()).toEqual(expect.arrayContaining(["TST90"]));
    expect(isPromoCodeBlockedForCheckout("TST90")).toBe(true);
    expect(isPromoCodeBlockedForCheckout(" tst90 ")).toBe(true);
    expect(isPromoCodeBlockedForCheckout("OLIVE10")).toBe(false);
  });
});
