import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginOrRegisterGoogleUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCurrentLanguage } from "@/lib/language";
import {
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthConfig,
  readGoogleOAuthState,
  verifyGoogleIdToken,
} from "@/lib/google-oauth";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolvePublicSiteUrl } from "@/lib/site-url";

const GOOGLE_OAUTH_STATE_COOKIE = "chezolive_google_oauth_state";
const isSecureCookie = process.env.NODE_ENV === "production";

export const dynamic = "force-dynamic";

function withClearedStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie,
    path: "/",
    maxAge: 0,
  });

  return response;
}

function loginRedirect(request: Request, reason: string) {
  const baseUrl = resolvePublicSiteUrl({
    request,
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: env.nodeEnv,
  });
  const url = new URL("/login", baseUrl);
  url.searchParams.set("google", reason);
  return withClearedStateCookie(NextResponse.redirect(url));
}

function mapGoogleOAuthError(error: unknown) {
  if (!(error instanceof Error)) return "failed";

  if (error.message === "GOOGLE_EMAIL_NOT_VERIFIED") return "email_not_verified";
  if (error.message === "GOOGLE_ADMIN_FORBIDDEN") return "admin_not_allowed";
  if (error.message === "GOOGLE_OAUTH_STATE_EXPIRED") return "expired";
  if (error.message === "GOOGLE_OAUTH_STATE_INVALID") return "invalid_state";

  return "failed";
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const rate = await applyRateLimit(request, { namespace: "auth:google:callback", windowMs: 10 * 60_000, max: 30 });
  if (!rate.ok) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/callback",
      event: "GOOGLE_OAUTH_CALLBACK_RATE_LIMITED",
      status: 429,
      details: { durationMs: Date.now() - startedAt },
    });
    return loginRedirect(request, "rate_limited");
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/callback",
      event: "GOOGLE_OAUTH_CALLBACK_NOT_CONFIGURED",
      status: 503,
      details: { durationMs: Date.now() - startedAt },
    });
    return loginRedirect(request, "not_configured");
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("error")) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/callback",
      event: "GOOGLE_OAUTH_PROVIDER_ERROR",
      status: 400,
      details: {
        error: requestUrl.searchParams.get("error"),
        durationMs: Date.now() - startedAt,
      },
    });
    return loginRedirect(request, "cancelled");
  }

  try {
    const state = requestUrl.searchParams.get("state") ?? "";
    const code = requestUrl.searchParams.get("code") ?? "";
    const cookieStore = await cookies();
    const cookieState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? "";

    if (!state || !cookieState || state !== cookieState) {
      throw new Error("GOOGLE_OAUTH_STATE_INVALID");
    }
    if (!code) {
      throw new Error("GOOGLE_OAUTH_CODE_MISSING");
    }

    const statePayload = readGoogleOAuthState(state);
    const { idToken } = await exchangeGoogleAuthorizationCode(code, config);
    const profile = await verifyGoogleIdToken({
      idToken,
      clientId: config.clientId,
      nonce: statePayload.nonce,
    });
    const language = await getCurrentLanguage();
    const user = await loginOrRegisterGoogleUser(profile, language);
    const baseUrl = resolvePublicSiteUrl({
      request,
      configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
      nodeEnv: env.nodeEnv,
    });
    const response = withClearedStateCookie(NextResponse.redirect(new URL(statePayload.returnTo, baseUrl)));

    logApiEvent({
      level: "INFO",
      route: "/api/auth/google/callback",
      event: "GOOGLE_OAUTH_CALLBACK_SUCCESS",
      status: 302,
      details: { userId: user.id, returnTo: statePayload.returnTo, durationMs: Date.now() - startedAt },
    });

    return response;
  } catch (error) {
    const reason = mapGoogleOAuthError(error);
    logApiEvent({
      level: "WARN",
      route: "/api/auth/google/callback",
      event: "GOOGLE_OAUTH_CALLBACK_FAILED",
      status: 400,
      details: { reason, error, durationMs: Date.now() - startedAt },
    });
    return loginRedirect(request, reason);
  }
}
