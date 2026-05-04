"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

const CART_STORAGE_KEY = "chezolive_cart_v1";

type CartLine = { productId: string; quantity: number };

type Props = {
  language: Language;
  userRole: UserRole | null;
};

function readCartCount() {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return 0;

  try {
    return (JSON.parse(raw) as CartLine[]).reduce((total, line) => total + line.quantity, 0);
  } catch {
    return 0;
  }
}

export function PwaAppHeader({ language, userRole }: Props) {
  const [cartCount, setCartCount] = useState(0);
  const previousCountRef = useRef(0);

  useEffect(() => {
    const syncCart = () => {
      const nextCount = readCartCount();
      if (nextCount !== previousCountRef.current) {
        previousCountRef.current = nextCount;
        setCartCount(nextCount);
      }
    };

    syncCart();
    const interval = window.setInterval(syncCart, 250);
    window.addEventListener("storage", syncCart);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  return (
    <header className="pwa-app-header" aria-label={language === "fr" ? "En-tete application" : "App header"}>
      <Link className="pwa-app-header__brand" href="/app" aria-label="Chez Olive App">
        <Image
          src="/images/chez-olive/chezolive-logo-mark-tight.png"
          alt=""
          width={56}
          height={56}
          className="pwa-app-header__logo"
          priority
        />
        <span>
          <strong>Chez Olive</strong>
          <small>{language === "fr" ? "App" : "App"}</small>
        </span>
      </Link>

      <nav className="pwa-app-header__actions" aria-label={language === "fr" ? "Actions application" : "App actions"}>
        <Link className="pwa-app-header__action" href="/cart" aria-label={language === "fr" ? `Panier ${cartCount}` : `Cart ${cartCount}`}>
          <span aria-hidden="true">Panier</span>
          <em>{cartCount}</em>
        </Link>
        <Link className="pwa-app-header__action" href={userRole ? "/account" : "/login"}>
          {userRole ? (language === "fr" ? "Compte" : "Account") : (language === "fr" ? "Connexion" : "Sign in")}
        </Link>
        {userRole === "ADMIN" ? (
          <Link className="pwa-app-header__action pwa-app-header__action--admin" href="/admin">
            Admin
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
