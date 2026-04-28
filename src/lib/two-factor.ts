import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const isSecureCookie = process.env.NODE_ENV === "production";
const cookieSameSite = isSecureCookie ? "strict" : "lax";

const TWO_FACTOR_VERSION = "v1";
const TWO_FACTOR_ISSUER = "Chez Olive";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;
const LOGIN_CHALLENGE_COOKIE_NAME = "chezolive_2fa_login";
const SETUP_COOKIE_NAME = "chezolive_2fa_setup";
const LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SETUP_TTL_MS = 10 * 60 * 1000;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

type TwoFactorSignedPayload = {
  v: typeof TWO_FACTOR_VERSION;
  userId: string;
  expiresAt: number;
};

type TwoFactorSetupPayload = TwoFactorSignedPayload & {
  secret: string;
};

const base64UrlEncode = (value: Buffer | string) => {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
};

const signPayload = (encodedPayload: string) =>
  createHmac("sha256", env.sessionSecret).update(encodedPayload).digest("base64url");

const encodeSignedPayload = (payload: TwoFactorSignedPayload | TwoFactorSetupPayload) => {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

function decodeSignedPayload<T extends TwoFactorSignedPayload>(cookieValue?: string | null): T | null {
  if (!cookieValue) return null;

  const [encodedPayload, signature, ...extra] = cookieValue.split(".");
  if (!encodedPayload || !signature || extra.length > 0) return null;

  const expectedSignature = signPayload(encodedPayload);
  const providedSignature = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedSignature.length !== expectedSignatureBuffer.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignatureBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as T;
    if (payload.v !== TWO_FACTOR_VERSION || typeof payload.userId !== "string" || typeof payload.expiresAt !== "number") {
      return null;
    }
    if (payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function setSignedCookie(name: string, value: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    sameSite: cookieSameSite,
    secure: isSecureCookie,
    path: "/",
    expires: expiresAt,
  });
}

async function clearCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

function normalizeBase32(input: string) {
  return input.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function decodeBase32(input: string) {
  const normalized = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error("INVALID_BASE32");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function encodeBase32(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function generateHotp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTwoFactorSecret() {
  return encodeBase32(randomBytes(20));
}

export function formatTwoFactorSecret(secret: string) {
  return normalizeBase32(secret).match(/.{1,4}/g)?.join(" ") ?? normalizeBase32(secret);
}

export function buildTwoFactorOtpAuthUri(email: string, secret: string) {
  const label = encodeURIComponent(`${TWO_FACTOR_ISSUER}:${email}`);
  const issuer = encodeURIComponent(TWO_FACTOR_ISSUER);
  return `otpauth://totp/${label}?secret=${normalizeBase32(secret)}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function verifyTotpCode(secret: string, input: string, now = Date.now()) {
  const normalizedInput = input.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(normalizedInput)) return false;

  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -TOTP_WINDOW_STEPS; offset <= TOTP_WINDOW_STEPS; offset += 1) {
    if (generateHotp(secret, counter + offset) === normalizedInput) {
      return true;
    }
  }

  return false;
}

const normalizeBackupCode = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString("hex").toUpperCase();
    return raw.match(/.{1,4}/g)?.join("-") ?? raw;
  });
}

export function hashBackupCode(code: string) {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

export function consumeBackupCode(storedHashesJson: string | null | undefined, input: string) {
  const normalizedInput = normalizeBackupCode(input);
  if (!normalizedInput) {
    return { matched: false as const, nextHashesJson: storedHashesJson ?? "[]" };
  }

  let hashes: string[];
  try {
    hashes = JSON.parse(storedHashesJson ?? "[]") as string[];
  } catch {
    hashes = [];
  }

  const inputHash = hashBackupCode(normalizedInput);
  const index = hashes.findIndex((hash) => hash === inputHash);
  if (index === -1) {
    return { matched: false as const, nextHashesJson: JSON.stringify(hashes) };
  }

  const nextHashes = hashes.filter((_, itemIndex) => itemIndex !== index);
  return { matched: true as const, nextHashesJson: JSON.stringify(nextHashes), remainingCount: nextHashes.length };
}

function deriveEncryptionKey() {
  return createHash("sha256").update(`chezolive:2fa:${env.sessionSecret}`).digest();
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [base64UrlEncode(iv), base64UrlEncode(authTag), base64UrlEncode(ciphertext)].join(".");
}

export function decryptTwoFactorSecret(payload: string) {
  const [ivEncoded, tagEncoded, ciphertextEncoded, ...extra] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded || extra.length > 0) {
    throw new Error("INVALID_TWO_FACTOR_SECRET");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(), base64UrlDecode(ivEncoded));
  decipher.setAuthTag(base64UrlDecode(tagEncoded));
  const plaintext = Buffer.concat([
    decipher.update(base64UrlDecode(ciphertextEncoded)),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export async function createTwoFactorLoginChallenge(userId: string) {
  const expiresAt = new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS);
  const value = encodeSignedPayload({
    v: TWO_FACTOR_VERSION,
    userId,
    expiresAt: expiresAt.getTime(),
  });
  await setSignedCookie(LOGIN_CHALLENGE_COOKIE_NAME, value, expiresAt);
}

export async function readTwoFactorLoginChallenge() {
  const cookieStore = await cookies();
  return decodeSignedPayload<TwoFactorSignedPayload>(cookieStore.get(LOGIN_CHALLENGE_COOKIE_NAME)?.value);
}

export async function clearTwoFactorLoginChallenge() {
  await clearCookie(LOGIN_CHALLENGE_COOKIE_NAME);
}

export async function createTwoFactorSetupChallenge(userId: string, secret: string) {
  const expiresAt = new Date(Date.now() + SETUP_TTL_MS);
  const value = encodeSignedPayload({
    v: TWO_FACTOR_VERSION,
    userId,
    secret,
    expiresAt: expiresAt.getTime(),
  });
  await setSignedCookie(SETUP_COOKIE_NAME, value, expiresAt);
}

export async function readTwoFactorSetupChallenge() {
  const cookieStore = await cookies();
  return decodeSignedPayload<TwoFactorSetupPayload>(cookieStore.get(SETUP_COOKIE_NAME)?.value);
}

export async function clearTwoFactorSetupChallenge() {
  await clearCookie(SETUP_COOKIE_NAME);
}
