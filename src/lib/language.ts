import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, normalizeLanguage, type Language } from "@/lib/i18n";

export async function getCurrentLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
}

export async function setCurrentLanguage(language: Language) {
  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE, language, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
