import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { ADMIN_ACCESS_COOKIE_NAME, createAdminAccessCookieValue } from "@/lib/admin-access-cookie";
import { DEV_SESSION_SECRET, env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  buildTwoFactorOtpAuthUri,
  clearTwoFactorLoginChallenge,
  clearTwoFactorSetupChallenge,
  consumeBackupCode,
  createTwoFactorLoginChallenge,
  createTwoFactorSetupChallenge,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  formatTwoFactorSecret,
  generateBackupCodes,
  generateTwoFactorSecret,
  hashBackupCode,
  readTwoFactorLoginChallenge,
  readTwoFactorSetupChallenge,
  verifyTotpCode,
} from "@/lib/two-factor";
import { logApiEvent } from "@/lib/observability";

const isSecureCookie = process.env.NODE_ENV === "production";
const sessionCookieSameSite = isSecureCookie ? "strict" : "lax";

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

type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

type SessionUser = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: "CUSTOMER" | "ADMIN";
  language: string;
  twoFactorEnabled: boolean;
  twoFactorSecretCiphertext: string | null;
  twoFactorBackupCodesJson: string | null;
  twoFactorEnabledAt: Date | null;
};

type LoginResult = {
  requiresTwoFactor: boolean;
  user: NonNullable<AuthenticatedUser>;
};

const toCurrentUser = (user: SessionUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  language: (user.language === "en" ? "en" : "fr") as "fr" | "en",
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
});

async function createSessionForUser(user: Pick<SessionUser, "id" | "role">) {
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
    sameSite: sessionCookieSameSite,
    secure: isSecureCookie,
    path: "/",
    expires: expiresAt,
  });

  if (user.role === "ADMIN") {
    const adminAccessCookie = await createAdminAccessCookieValue({
      sessionToken: token,
      expiresAt,
      secret: env.sessionSecret,
    });

    cookieStore.set(ADMIN_ACCESS_COOKIE_NAME, adminAccessCookie, {
      httpOnly: true,
      sameSite: sessionCookieSameSite,
      secure: isSecureCookie,
      path: "/",
      expires: expiresAt,
    });
  }
}

function logAuthLatency(metric: string, durationMs: number, details?: Record<string, unknown>) {
  if (durationMs < 120) {
    return;
  }

  const level = durationMs > 120 ? "WARN" : "INFO";
  logApiEvent({
    level,
    route: "lib/auth",
    event: metric,
    status: 200,
    details: {
      durationMs,
      ...(details ?? {}),
    },
  });
}

async function getCurrentSessionWithUser() {
  const start = Date.now();

  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    logAuthLatency("SESSION_LOOKUP_EXPIRED", Date.now() - start, { found: false, tokenProvided: true });
    return null;
  }

  logAuthLatency("SESSION_LOOKUP", Date.now() - start, { found: true, userId: session.userId });
  return session;
}

async function requireCurrentSessionWithUser() {
  const session = await getCurrentSessionWithUser();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

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

  const start = Date.now();
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  logAuthLatency("USER_LOOKUP", Date.now() - start, { email: email.toLowerCase() });
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordStart = Date.now();
  const ok = await verifyPassword(password, user.passwordHash);
  logAuthLatency("PASSWORD_CHECK", Date.now() - passwordStart, { userId: user.id });
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.role === "ADMIN" && user.twoFactorEnabled && user.twoFactorSecretCiphertext) {
    logAuthLatency("LOGIN_WITH_2FA", Date.now() - start, { userId: user.id, role: user.role });
    await createTwoFactorLoginChallenge(user.id);
    return {
      requiresTwoFactor: true,
      user: toCurrentUser(user as SessionUser),
    } satisfies LoginResult;
  }

  await clearTwoFactorLoginChallenge();
  await createSessionForUser({ id: user.id, role: user.role });
  logAuthLatency("LOGIN_SESSION_CREATED", Date.now() - start, { userId: user.id, role: user.role });

  return {
    requiresTwoFactor: false,
    user: toCurrentUser(user as SessionUser),
  } satisfies LoginResult;
}

export async function verifyTwoFactorLogin(code: string) {
  ensureSessionSecret();

  const challenge = await readTwoFactorLoginChallenge();
  if (!challenge) {
    throw new Error("TWO_FACTOR_CHALLENGE_REQUIRED");
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || user.role !== "ADMIN" || !user.twoFactorEnabled || !user.twoFactorSecretCiphertext) {
    await clearTwoFactorLoginChallenge();
    throw new Error("TWO_FACTOR_CHALLENGE_REQUIRED");
  }

  const secret = decryptTwoFactorSecret(user.twoFactorSecretCiphertext);
  let matched = verifyTotpCode(secret, code);
  let nextBackupCodesJson = user.twoFactorBackupCodesJson ?? "[]";
  let usedBackupCode = false;

  if (!matched) {
    const backupResult = consumeBackupCode(user.twoFactorBackupCodesJson, code);
    if (!backupResult.matched) {
      throw new Error("INVALID_TWO_FACTOR_CODE");
    }
    matched = true;
    usedBackupCode = true;
    nextBackupCodesJson = backupResult.nextHashesJson;
  }

  if (usedBackupCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodesJson: nextBackupCodesJson },
    });
  }

  await clearTwoFactorLoginChallenge();
  await createSessionForUser({ id: user.id, role: user.role });

  return toCurrentUser({
    ...(user as SessionUser),
    twoFactorBackupCodesJson: nextBackupCodesJson,
  });
}

export async function changePasswordForCurrentUser(currentPassword: string, newPassword: string) {
  ensureSessionSecret();

  const session = await requireCurrentSessionWithUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) throw new Error("UNAUTHORIZED");

  const currentPasswordOk = await verifyPassword(currentPassword, session.user.passwordHash);
  if (!currentPasswordOk) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const isSamePassword = await verifyPassword(newPassword, session.user.passwordHash);
  if (isSamePassword) {
    throw new Error("PASSWORD_UNCHANGED");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({
      where: {
        userId: session.userId,
        token: { not: token },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: session.userId,
      },
    }),
  ]);
}

export async function revokeOtherSessionsForCurrentUser() {
  ensureSessionSecret();

  const session = await requireCurrentSessionWithUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) throw new Error("UNAUTHORIZED");

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.session.deleteMany({
      where: {
        userId: session.userId,
        token: { not: token },
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "OTHER_SESSIONS_REVOKED",
        entity: "User",
        entityId: session.userId,
        metadata: JSON.stringify({ revokedCount: deleted.count }),
      },
    });

    return deleted;
  });

  return { revokedCount: result.count };
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(env.sessionCookieName);
  cookieStore.delete(ADMIN_ACCESS_COOKIE_NAME);
  await clearTwoFactorLoginChallenge();
  await clearTwoFactorSetupChallenge();
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
  const session = await getCurrentSessionWithUser();
  if (!session) return null;
  return toCurrentUser(session.user as SessionUser);
}

export async function beginTwoFactorSetupForCurrentUser() {
  ensureSessionSecret();

  const session = await requireCurrentSessionWithUser();
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  if (session.user.twoFactorEnabled) {
    throw new Error("TWO_FACTOR_ALREADY_ENABLED");
  }

  const secret = generateTwoFactorSecret();
  await createTwoFactorSetupChallenge(session.userId, secret);

  return {
    manualEntryKey: formatTwoFactorSecret(secret),
    otpauthUri: buildTwoFactorOtpAuthUri(session.user.email, secret),
  };
}

export async function confirmTwoFactorSetupForCurrentUser(currentPassword: string, code: string) {
  ensureSessionSecret();

  const session = await requireCurrentSessionWithUser();
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  if (session.user.twoFactorEnabled) {
    throw new Error("TWO_FACTOR_ALREADY_ENABLED");
  }

  const passwordOk = await verifyPassword(currentPassword, session.user.passwordHash);
  if (!passwordOk) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const setup = await readTwoFactorSetupChallenge();
  if (!setup || setup.userId !== session.userId) {
    throw new Error("TWO_FACTOR_SETUP_REQUIRED");
  }

  if (!verifyTotpCode(setup.secret, code)) {
    throw new Error("INVALID_TWO_FACTOR_CODE");
  }

  const backupCodes = generateBackupCodes();
  const backupCodeHashes = JSON.stringify(backupCodes.map((backupCode) => hashBackupCode(backupCode)));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecretCiphertext: encryptTwoFactorSecret(setup.secret),
        twoFactorBackupCodesJson: backupCodeHashes,
        twoFactorEnabledAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "TWO_FACTOR_ENABLED",
        entity: "User",
        entityId: session.userId,
      },
    }),
  ]);

  await clearTwoFactorSetupChallenge();

  return { backupCodes };
}

export async function disableTwoFactorForCurrentUser(currentPassword: string, code: string) {
  ensureSessionSecret();

  const session = await requireCurrentSessionWithUser();
  if (session.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  if (!session.user.twoFactorEnabled || !session.user.twoFactorSecretCiphertext) {
    throw new Error("TWO_FACTOR_NOT_ENABLED");
  }

  const passwordOk = await verifyPassword(currentPassword, session.user.passwordHash);
  if (!passwordOk) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  const secret = decryptTwoFactorSecret(session.user.twoFactorSecretCiphertext);
  const validTotp = verifyTotpCode(secret, code);
  const backupResult = validTotp ? null : consumeBackupCode(session.user.twoFactorBackupCodesJson, code);

  if (!validTotp && !backupResult?.matched) {
    throw new Error("INVALID_TWO_FACTOR_CODE");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretCiphertext: null,
        twoFactorBackupCodesJson: null,
        twoFactorEnabledAt: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "TWO_FACTOR_DISABLED",
        entity: "User",
        entityId: session.userId,
        metadata: JSON.stringify({ viaBackupCode: Boolean(backupResult?.matched) }),
      },
    }),
  ]);

  await clearTwoFactorSetupChallenge();
}

