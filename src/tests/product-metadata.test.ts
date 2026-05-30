import type { Metadata } from "next";
import {
  PRODUCT_SOCIAL_IMAGE_FALLBACK,
  buildProductSocialMetadata,
} from "@/lib/product-share";

function getOpenGraphImages(metadata: Metadata) {
  return metadata.openGraph?.images as Array<{ url: string; alt: string }> | undefined;
}

describe("product social metadata", () => {
  it("expose le titre et la description Open Graph avec le prix", () => {
    const metadata = buildProductSocialMetadata({
      language: "fr",
      slug: "lit-douillet-anti-stress",
      name: "Lit douillet anti-stress",
      priceLabel: "69,99 $",
      imageUrl: "/uploads/lit.png",
      siteUrl: "https://chezolive.ca",
    });

    expect(metadata.title).toBe("Lit douillet anti-stress — 69,99 $");
    expect(metadata.description).toContain("69,99 $");
    expect(metadata.alternates?.canonical).toBe("/products/lit-douillet-anti-stress");
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        title: "Lit douillet anti-stress — 69,99 $ | Chez Olive",
        description: expect.stringContaining("Consulte la fiche produit"),
        url: "https://chezolive.ca/products/lit-douillet-anti-stress",
      }),
    );
    expect(getOpenGraphImages(metadata)?.[0]).toEqual({
      url: "https://chezolive.ca/uploads/lit.png",
      alt: "Lit douillet anti-stress",
    });
  });

  it("utilise le logo Chez Olive quand le produit n'a pas d'image", () => {
    const metadata = buildProductSocialMetadata({
      language: "en",
      slug: "simple-collar",
      name: "Simple collar",
      priceLabel: "$24.99",
      imageUrl: null,
      siteUrl: "https://chezolive.ca",
    });

    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        title: "Simple collar — $24.99 | Chez Olive",
        description: "Simple collar for $24.99 at Chez Olive. View the product details.",
        url: "https://chezolive.ca/products/simple-collar",
      }),
    );
    expect(getOpenGraphImages(metadata)?.[0]).toEqual({
      url: `https://chezolive.ca${PRODUCT_SOCIAL_IMAGE_FALLBACK}`,
      alt: "Simple collar",
    });
  });
});
