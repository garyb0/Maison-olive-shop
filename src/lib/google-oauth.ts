import {
  createHmac,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
  type JsonWebKey as CryptoJsonWebKey,
} from "crypto";
import { env } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_OAUTH_SCOPE = "openid email profile";
const GOOGLE_OAUTH_STATE_VERSION = 1;
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

type GoogleOAuthStatePayload = {
  v: typeof GOOGLE_OAUTH_STATE_VERSION;
  returnTo: string;
  nonce: string;
  exp: number;
};

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleJwk = CryptoJsonWebKey & {
  kid?: string;
  alg?: string;
};

type GoogleJwksResponse = {
  keys?: GoogleJwk[];
};

type GoogleIdTokenHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type GoogleIdTokenPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleVerifiedProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
};

let jwksCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", env.sessionSecret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function sanitizeGoogleOAuthReturnTo(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  if (/[\r\n]/.test(raw)) return "/account";
  return raw;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = env.googleOAuthClientId.trim();
  const clientSecret = env.googleOAuthClientSecret.trim();
  const redirectUri = env.googleOAuthRedirectUri.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function isGoogleOAuthConfigured() {
  return Boolean(getGoogleOAuthConfig());
}

export function createGoogleOAuthState(returnTo: string) {
  const payload: GoogleOAuthStatePayload = {
    v: GOOGLE_OAUTH_STATE_VERSION,
    returnTo: sanitizeGoogleOAuthReturnTo(returnTo),
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + GOOGLE_OAUTH_STATE_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return {
    state: `${encodedPayload}.${signPayload(encodedPayload)}`,
    payload,
  };
}

export function readGoogleOAuthState(state: string) {
  const [encodedPayload, signature, extra] = state.split(".");
  if (!encodedPayload || !signature || extra) {
    throw new Error("GOOGLE_OAUTH_STATE_INVALID");
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    throw new Error("GOOGLE_OAUTH_STATE_INVALID");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as GoogleOAuthStatePayload;
  if (payload.v !== GOOGLE_OAUTH_STATE_VERSION || typeof payload.returnTo !== "string" || typeof payload.nonce !== "string") {
    throw new Error("GOOGLE_OAUTH_STATE_INVALID");
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    throw new Error("GOOGLE_OAUTH_STATE_EXPIRED");
  }

  return {
    ...payload,
    returnTo: sanitizeGoogleOAuthReturnTo(payload.returnTo),
  };
}

export function buildGoogleAuthorizationUrl(input: {
  config: GoogleOAuthConfig;
  state: string;
  nonce: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleAuthorizationCode(code: string, config: GoogleOAuthConfig) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || !token.id_token) {
    throw new Error(token.error_description || token.error || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }

  return {
    idToken: token.id_token,
  };
}

async function getGoogleJwks() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) {
    throw new Error("GOOGLE_JWKS_FETCH_FAILED");
  }

  const body = (await response.json()) as GoogleJwksResponse;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  jwksCache = {
    keys,
    expiresAt: Date.now() + Math.max(60, maxAgeSeconds) * 1000,
  };

  return keys;
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value)) as T;
}

function hasExpectedAudience(audience: string | string[] | undefined, clientId: string) {
  if (typeof audience === "string") return audience === clientId;
  return Array.isArray(audience) && audience.includes(clientId);
}

export async function verifyGoogleIdToken(input: {
  idToken: string;
  clientId: string;
  nonce: string;
}): Promise<GoogleVerifiedProfile> {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = input.idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID");
  }

  const header = parseJwtPart<GoogleIdTokenHeader>(encodedHeader);
  const payload = parseJwtPart<GoogleIdTokenPayload>(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID");
  }

  const jwks = await getGoogleJwks();
  const jwk = jwks.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("GOOGLE_ID_TOKEN_KEY_NOT_FOUND");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const signatureOk = verifier.verify(
    createPublicKey({ key: jwk as CryptoJsonWebKey, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!signatureOk) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID_SIGNATURE");
  }

  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID_ISSUER");
  }
  if (!hasExpectedAudience(payload.aud, input.clientId)) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID_AUDIENCE");
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("GOOGLE_ID_TOKEN_EXPIRED");
  }
  if (payload.nonce !== input.nonce) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID_NONCE");
  }
  if (!payload.sub || !payload.email) {
    throw new Error("GOOGLE_ID_TOKEN_MISSING_PROFILE");
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified,
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
    picture: payload.picture,
  };
}
