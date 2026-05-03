"use client";

import { useEffect } from "react";
import type { Language } from "@/lib/i18n";
import { trackConversionEvent } from "@/lib/conversion-tracker";

type Props = {
  productId: string;
  productSlug: string;
  language: Language;
};

export function ProductConversionTracker({ productId, productSlug, language }: Props) {
  useEffect(() => {
    trackConversionEvent("PRODUCT_VIEW", {
      productId,
      productSlug,
      language,
    });
  }, [language, productId, productSlug]);

  return null;
}
