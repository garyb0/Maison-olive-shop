import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { DEV_SESSION_SECRET, env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { logApiEvent } from "@/lib/observability"; // eslint-disable-line @typescript-eslint/no-unused-vars

const ensureSessionSecret = () => {
  if (process.env.NODE_ENV === "production" && env.sessionSecret === DEV_SESSION_SECRET) {
    throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  }
};

type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  language?: "fr" | "en";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      language: input.language ?? "fr",
    },
  });

  return user;
}

export async function loginUser(email: string, password: string) {
  ensureSessionSecret();

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.sessionDurationDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(env.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return user;
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(env.sessionCookieName);
}

// ─── Password Reset ─────────────────────────────────────────────────────────

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates a password-reset token for the given email.
 * Returns the plain token (to be sent by email) or null if the email
 * is not registered (we don't reveal whether the address exists).
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  // Purge any previous tokens for this user
  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

  await prisma.passwordReset.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  return token;
}

/**
 * Validates a reset token and updates the user's password.
 * Invalidates all active sessions for that user.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
  });

  if (!reset) throw new Error("INVALID_RESET_TOKEN");
  if (reset.usedAt) throw new Error("RESET_TOKEN_ALREADY_USED");
  if (reset.expiresAt < new Date()) throw new Error("RESET_TOKEN_EXPIRED");

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    cookieStore.delete(env.sessionCookieName);
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    role: session.user.role,
    language: (session.user.language === "en" ? "en" : "fr") as "fr" | "en",
  };
}
