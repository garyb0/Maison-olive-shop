export {};

import { describe, expect, it } from "vitest";
import { isValidPromoCtaLink, sanitizePromoCtaLink } from "@/lib/promo-links";

describe("promo CTA link validation", () => {
  it("accepts known public routes and dynamic storefront routes", () => {
    expect(isValidPromoCtaLink("/")).toBe(true);
    expect(isValidPromoCtaLink("/checkout")).toBe(true);
    expect(isValidPromoCtaLink("/faq#retours")).toBe(true);
    expect(isValidPromoCtaLink("/shipping")).toBe(true);
    expect(isValidPromoCtaLink("/products/olive-bed")).toBe(true);
    expect(isValidPromoCtaLink("/dog/public-token-123")).toBe(true);
  });

  it("rejects admin, api and unknown routes", () => {
    expect(isValidPromoCtaLink("/admin")).toBe(false);
    expect(isValidPromoCtaLink("/api/promo-banners")).toBe(false);
    expect(isValidPromoCtaLink("/unknown-page")).toBe(false);
    expect(isValidPromoCtaLink("https://chezolive.ca")).toBe(false);
  });

  it("falls back invalid links to the storefront root", () => {
    expect(sanitizePromoCtaLink("/admin/orders")).toBe("/");
    expect(sanitizePromoCtaLink("/unknown-page")).toBe("/");
    expect(sanitizePromoCtaLink("/checkout?promo=olive")).toBe("/checkout?promo=olive");
  });
});
