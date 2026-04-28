const PUBLIC_PROMO_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/account$/,
  /^\/account\/dogs$/,
  /^\/account\/orders$/,
  /^\/account\/orders\/[^/]+$/,
  /^\/account\/profile$/,
  /^\/account\/subscriptions$/,
  /^\/account\/support$/,
  /^\/boutique$/,
  /^\/cart$/,
  /^\/checkout$/,
  /^\/dog\/[^/]+$/,
  /^\/faq$/,
  /^\/forgot-password$/,
  /^\/login$/,
  /^\/maintenance$/,
  /^\/products\/[^/]+$/,
  /^\/reset-password$/,
  /^\/returns$/,
  /^\/sell$/,
  /^\/shipping$/,
  /^\/terms$/,
];

export const PROMO_CTA_LINK_HELP_TEXT =
  "Exemples valides: /, /boutique, /checkout, /faq, /shipping, /products/nom-du-produit";

function extractPathname(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const pathname = trimmed.split(/[?#]/, 1)[0];
  if (!pathname) {
    return "/";
  }

  return pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
}

export function isValidPromoCtaLink(rawValue: string): boolean {
  const pathname = extractPathname(rawValue);
  if (!pathname) {
    return false;
  }

  if (pathname.startsWith("/api/") || pathname === "/api") {
    return false;
  }

  if (pathname.startsWith("/admin/") || pathname === "/admin") {
    return false;
  }

  return PUBLIC_PROMO_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function sanitizePromoCtaLink(rawValue: string | null | undefined): string {
  if (!rawValue) {
    return "/";
  }

  const trimmed = rawValue.trim();
  return isValidPromoCtaLink(trimmed) ? trimmed : "/";
}
