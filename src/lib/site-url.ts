export const DEFAULT_DEV_SITE_URL = "http://localhost:3101";

export function normalizeSiteUrl(value: string | undefined | null) {
  const raw = value?.trim();
  if (!raw) return DEFAULT_DEV_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export function isLocalhostSiteUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|::1/i.test(value);
  }
}

export function isSecureSiteUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

type ResolvePublicSiteUrlOptions = {
  request?: Request;
  configuredUrl?: string | null;
  nodeEnv?: string;
};

export function resolvePublicSiteUrl(options: ResolvePublicSiteUrlOptions = {}) {
  const configuredUrl = options.configuredUrl ?? process.env.NEXT_PUBLIC_SITE_URL;
  const configured = configuredUrl?.trim();
  if (configured) {
    return normalizeSiteUrl(configured);
  }

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "production" && options.request) {
    try {
      return normalizeSiteUrl(new URL(options.request.url).origin);
    } catch {
      // Fall back to the local dev URL below.
    }
  }

  return DEFAULT_DEV_SITE_URL;
}
