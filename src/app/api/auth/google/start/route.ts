import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  sanitizeGoogleOAuthReturnTo,
} from "@/lib/google-oauth";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolvePublicSiteUrl } from "@/lib/site-url";

const GOOGLE_OAUTH_STATE_COOKIE = "chezolive_google_oauth_state";
const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const isSecureCookie = process.env.NODE_ENV === "production";

export const dynamic = "force-dynamic";

function loginRedirect(request: Request, reason: string) {
  const baseUrl = resolvePublicSiteUrl({
    request,
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: env.nodeEnv,
  });
  const url = new URL("/login", baseUrl);
  url.searchParams.set("google", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rate = await applyRateLimit(request, { namespace: "auth:google:start", windowMs: 10 * 60_000, max: 30 });
  if (!rate.ok) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/start",
      event: "GOOGLE_OAUTH_START_RATE_LIMITED",
      status: 429,
      details: { durationMs: Date.now() - startedAt },
    });
    return loginRedirect(request, "rate_limited");
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/start",
      event: "GOOGLE_OAUTH_NOT_CONFIGURED",
      status: 503,
      details: { durationMs: Date.now() - startedAt },
    });
    return loginRedirect(request, "not_configured");
  }

  const requestUrl = new URL(request.url);
  const returnTo = sanitizeGoogleOAuthReturnTo(requestUrl.searchParams.get("returnTo"));
  const { state, payload } = createGoogleOAuthState(returnTo);
  const authorizationUrl = buildGoogleAuthorizationUrl({
    config,
    state,
    nonce: payload.nonce,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie,
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  });

  logApiEvent({
    level: "INFO",
    route: "/api/auth/google/start",
    event: "GOOGLE_OAUTH_START",
    status: 302,
    details: { returnTo, durationMs: Date.now() - startedAt },
  });

  return response;
}
