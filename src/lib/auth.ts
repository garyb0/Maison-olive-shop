import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { DEV_SESSION_SECRET, env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

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
