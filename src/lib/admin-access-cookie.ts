const ADMIN_ACCESS_VERSION = "v1";

export const ADMIN_ACCESS_COOKIE_NAME = "chezolive_admin_access";

type AdminAccessPayload = {
  v: typeof ADMIN_ACCESS_VERSION;
  role: "ADMIN";
  sessionToken: string;
  expiresAt: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlEncode(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function createAdminAccessCookieValue(input: {
  sessionToken: string;
  expiresAt: Date;
  secret: string;
}) {
  const payload: AdminAccessPayload = {
    v: ADMIN_ACCESS_VERSION,
    role: "ADMIN",
    sessionToken: input.sessionToken,
    expiresAt: input.expiresAt.getTime(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, input.secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminAccessCookieValue(input: {
  cookieValue?: string;
  sessionToken?: string;
  secret: string;
  now?: Date;
}) {
  if (!input.cookieValue || !input.sessionToken) return false;

  const [encodedPayload, signature, ...extra] = input.cookieValue.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return false;

  const expectedSignature = await sign(encodedPayload, input.secret);
  if (!timingSafeEqualString(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminAccessPayload>;
    const nowMs = (input.now ?? new Date()).getTime();

    return (
      payload.v === ADMIN_ACCESS_VERSION &&
      payload.role === "ADMIN" &&
      payload.sessionToken === input.sessionToken &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > nowMs
    );
  } catch {
    return false;
  }
}
