"use client";

import Link from "next/link";
import type { Language } from "@/lib/i18n";

type GoogleAuthButtonProps = {
  language: Language;
  returnTo?: string;
  className?: string;
  label?: string;
};

function getGoogleAuthHref(returnTo: string | undefined) {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  const query = params.toString();
  return query ? `/api/auth/google/start?${query}` : "/api/auth/google/start";
}

export function GoogleAuthButton({
  language,
  returnTo,
  className = "",
  label,
}: GoogleAuthButtonProps) {
  const text = label ?? (language === "fr" ? "Continuer avec Google" : "Continue with Google");

  return (
    <Link className={`google-auth-button ${className}`.trim()} href={getGoogleAuthHref(returnTo)}>
      <span className="google-auth-button__mark" aria-hidden="true">
        G
      </span>
      <span>{text}</span>
    </Link>
  );
}
