export const DEFAULT_DEV_SITE_URL = "http://localhost:3101";
export const DEFAULT_PRODUCTION_SITE_URL = "https://chezolive.ca";
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function normalizeSiteUrl(value: string | undefined | null) {
  const raw = value?.trim();
  if (!raw) return DEFAULT_DEV_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export function isLocalhostSiteUrl(value: string) {
  try {
    const url = new URL(value);
    return LOCALHOST_NAMES.has(url.hostname);
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

function requestOriginFromHeaders(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || requestUrl.host;
  if (!host) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "") || "https";

  try {
    return normalizeSiteUrl(`${protocol}://${host}`);
  } catch {
    return null;
  }
}

export function resolvePublicSiteUrl(options: ResolvePublicSiteUrlOptions = {}) {
  const configuredUrl = options.configuredUrl ?? process.env.NEXT_PUBLIC_SITE_URL;
  const configured = configuredUrl?.trim();
  if (configured) {
    return normalizeSiteUrl(configured);
  }

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (options.request) {
    const requestOrigin = requestOriginFromHeaders(options.request);
    if (requestOrigin && (nodeEnv !== "production" || !isLocalhostSiteUrl(requestOrigin))) {
      return requestOrigin;
    }
  }

  if (nodeEnv === "production") {
    return DEFAULT_PRODUCTION_SITE_URL;
  }

  return DEFAULT_DEV_SITE_URL;
}
