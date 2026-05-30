import type { Metadata } from "next";

export type ProductShareLanguage = "fr" | "en";

export type ProductShareTextInput = {
  language: ProductShareLanguage;
  name: string;
  priceLabel: string;
  url: string;
};

export type ProductSocialMetadataInput = {
  language: ProductShareLanguage;
  slug: string;
  name: string;
  priceLabel: string;
  imageUrl?: string | null;
  siteUrl?: string | null;
};

export const DEFAULT_PRODUCT_SHARE_SITE_URL = "https://chezolive.ca";
export const PRODUCT_SOCIAL_IMAGE_FALLBACK = "/olive-logo-2.png";
export const MESSENGER_FALLBACK_URL = "https://www.facebook.com/messages/";
export const FACEBOOK_SEND_DIALOG_URL = "https://www.facebook.com/dialog/send";
export const DEFAULT_FACEBOOK_SEND_REDIRECT_URL = "https://chezolive.ca/boutique";

export type FacebookSendDialogInput = {
  appId: string;
  link: string;
  redirectUri?: string | null;
};

export function buildProductPath(slug: string) {
  const cleanSlug = slug.trim().replace(/^\/+/, "").replace(/^products\//, "");
  return `/products/${cleanSlug}`;
}

export function normalizeProductShareSiteUrl(siteUrl?: string | null) {
  const raw = siteUrl?.trim();
  if (!raw) return DEFAULT_PRODUCT_SHARE_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export function buildAbsolutePublicUrl(pathOrUrl: string, siteUrl?: string | null) {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return new URL(path, normalizeProductShareSiteUrl(siteUrl)).toString();
  }
}

export function buildProductShareUrl(slug: string, siteUrl?: string | null) {
  return buildAbsolutePublicUrl(buildProductPath(slug), siteUrl);
}

export function buildFacebookShareUrl(url: string) {
  const shareUrl = new URL("https://www.facebook.com/sharer/sharer.php");
  shareUrl.searchParams.set("u", url);
  return shareUrl.toString();
}

export function buildFacebookSendDialogUrl({ appId, link, redirectUri }: FacebookSendDialogInput) {
  const dialogUrl = new URL(FACEBOOK_SEND_DIALOG_URL);
  dialogUrl.searchParams.set("app_id", appId.trim());
  dialogUrl.searchParams.set("link", link);
  dialogUrl.searchParams.set(
    "redirect_uri",
    buildAbsolutePublicUrl(redirectUri?.trim() || DEFAULT_FACEBOOK_SEND_REDIRECT_URL),
  );
  return dialogUrl.toString();
}

export function buildMessengerFallbackUrl() {
  return MESSENGER_FALLBACK_URL;
}

export function buildSmsShareUrl(message: string) {
  return `sms:?body=${encodeURIComponent(message)}`;
}

export function buildWhatsAppShareUrl(message: string) {
  const shareUrl = new URL("https://wa.me/");
  shareUrl.searchParams.set("text", message);
  return shareUrl.toString();
}

export function buildEmailShareUrl(subject: string, message: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

export function buildProductShareText({ language, name, priceLabel, url }: ProductShareTextInput) {
  if (language === "fr") {
    return `J’ai trouvé ${name} à ${priceLabel} chez Chez Olive. Voir le produit: ${url}`;
  }

  return `I found ${name} for ${priceLabel} at Chez Olive. View the product: ${url}`;
}

export function buildProductSocialDescription(language: ProductShareLanguage, name: string, priceLabel: string) {
  if (language === "fr") {
    return `${name} à ${priceLabel} chez Chez Olive. Consulte la fiche produit et les détails.`;
  }

  return `${name} for ${priceLabel} at Chez Olive. View the product details.`;
}

export function buildProductSocialMetadata({
  language,
  slug,
  name,
  priceLabel,
  imageUrl,
  siteUrl,
}: ProductSocialMetadataInput): Metadata {
  const productPath = buildProductPath(slug);
  const productUrl = buildProductShareUrl(slug, siteUrl);
  const image = buildAbsolutePublicUrl(imageUrl || PRODUCT_SOCIAL_IMAGE_FALLBACK, siteUrl);
  const title = `${name} — ${priceLabel}`;
  const socialTitle = `${name} — ${priceLabel} | Chez Olive`;
  const description = buildProductSocialDescription(language, name, priceLabel);

  return {
    title,
    description,
    alternates: {
      canonical: productPath,
    },
    openGraph: {
      type: "website",
      url: productUrl,
      siteName: "Chez Olive",
      title: socialTitle,
      description,
      locale: language === "fr" ? "fr_CA" : "en_CA",
      images: [
        {
          url: image,
          alt: name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
  };
}
