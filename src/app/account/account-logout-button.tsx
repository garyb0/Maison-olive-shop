"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  className?: string;
};

export function AccountLogoutButton({ language, className = "btn btn-secondary" }: Props) {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <button
      className={className}
      type="button"
      disabled={logoutLoading}
      onClick={() => void handleLogout()}
    >
      {logoutLoading
        ? language === "fr"
          ? "Déconnexion..."
          : "Signing out..."
        : language === "fr"
          ? "Déconnexion du compte"
          : "Sign out of account"}
    </button>
  );
}
