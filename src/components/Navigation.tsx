"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";
import Image from "next/image";
import logo from "@/assets/images/olive-logo-3.png";

const CART_STORAGE_KEY = "maisonolive_cart_v1";

type CartLine = { productId: string; quantity: number };

type Props = {
  language: Language;
  t: Dictionary;
  user: Pick<CurrentUser, "role"> | null;
  /** Optional custom logout handler */
  onLogout?: () => void;
};

export function Navigation({ language, t, user, onLogout }: Props) {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [langLoading, setLangLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const readCart = () => {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const count = raw
        ? (() => {
            try {
              return (JSON.parse(raw) as CartLine[]).reduce((acc, l) => acc + l.quantity, 0);
            } catch {
              return 0;
            }
          })()
        : 0;

      if (count !== prevCountRef.current) {
        if (count > prevCountRef.current) {
          setCartBump(true);
          setTimeout(() => setCartBump(false), 450);
        }
        prevCountRef.current = count;
        setCartCount(count);
      }
    };

    readCart();
    const interval = setInterval(readCart, 200);
    window.addEventListener("storage", readCart);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", readCart);
    };
  }, []);

  const onLanguageChange = async (nextLang: Language) => {
    setLangLoading(true);
    try {
      await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLang }),
      });
      location.reload();
    } finally {
      setLangLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      if (!user) {
        location.href = "/account";
        return;
      }
      if (onLogout) {
        onLogout();
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
        location.reload();
      }
    } finally {
      setLogoutLoading(false);
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Close menu when pathname changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="nav-header">
      {/* ── Brand / Logo ── */}
      <Link href="/" className="nav-brand">
        <Image
          src={logo}
          alt="Maison Olive"
          width={56}
          height={56}
          className="nav-logo-img"
          priority
        />
        <span className="nav-brand-name">{t.brandName}</span>
      </Link>

      {/* ── Hamburger (mobile) ── */}
      <button
        className="nav-hamburger"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={menuOpen}
        type="button"
      >
        <span className={`nav-hamburger-icon${menuOpen ? " open" : ""}`} />
      </button>

      {/* ── Links + Actions overlay ── */}
      <div className={`nav-body${menuOpen ? " nav-body--open" : ""}`}>
        {/* Primary links */}
        <nav className="nav-primary" aria-label={language === "fr" ? "Navigation principale" : "Main navigation"}>
          <Link className={`pill-link${isActive("/") ? " pill-link--active" : ""}`} href="/">
            🏠 {t.navHome}
          </Link>
          <Link className={`pill-link${isActive("/account") ? " pill-link--active" : ""}`} href="/account">
            👤 {t.navAccount}
          </Link>
          {user?.role === "ADMIN" && (
            <Link className={`pill-link pill-link--admin${isActive("/admin") ? " pill-link--active" : ""}`} href="/admin">
              ⚙️ {t.navAdmin}
            </Link>
          )}
        </nav>

        {/* Nav divider */}
        <span className="nav-sep" aria-hidden="true" />

        {/* Secondary links */}
        <nav className="nav-secondary" aria-label={language === "fr" ? "Navigation secondaire" : "Secondary navigation"}>
          <Link className={`pill-link pill-link--sm${isActive("/faq") ? " pill-link--active" : ""}`} href="/faq">
            {t.navFaq}
          </Link>
        </nav>

        <div className="nav-sell-center">
          <Link className={`pill-link pill-link--sm pill-link--sell${isActive("/sell") ? " pill-link--active" : ""}`} href="/sell">
            🌿 {t.navSell}
          </Link>
        </div>

        {/* Actions : langue + logout + panier */}
        <div className="nav-actions">
          <div className="nav-actions-top">
            <select
            className="nav-lang-select"
            value={language}
            disabled={langLoading}
            onChange={(e) => void onLanguageChange(e.target.value as Language)}
            aria-label={language === "fr" ? "Langue" : "Language"}
          >
            <option value="fr">🇫🇷 FR</option>
            <option value="en">🇬🇧 EN</option>
          </select>

            {user ? (
              <button
                className="nav-logout-inline"
                onClick={() => void handleLogout()}
                disabled={logoutLoading}
                type="button"
                aria-label={language === "fr" ? "Se déconnecter" : "Sign out"}
              >
                <span className="nav-logout-inline-icon" aria-hidden="true" />
                <span className="nav-logout-inline-tooltip" aria-hidden="true">
                  {logoutLoading
                    ? "…"
                    : language === "fr"
                      ? "Déconnexion"
                      : "Sign out"}
                </span>
              </button>
            ) : null}
          </div>

          <Link
            href="/cart"
            className={`nav-cart-btn${cartBump ? " nav-cart-bump" : ""}${isActive("/cart") ? " nav-cart-btn--active" : ""}`}
            aria-label={
              language === "fr"
                ? `Panier — ${cartCount} article${cartCount !== 1 ? "s" : ""}`
                : `Cart — ${cartCount} item${cartCount !== 1 ? "s" : ""}`
            }
          >
            🛒
            <span className={`nav-cart-count${cartCount === 0 ? " nav-cart-empty" : ""}`}>
              {cartCount}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
