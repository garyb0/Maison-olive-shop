"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";
import Image from "next/image";

const CART_STORAGE_KEY = "chezolive_cart_v1";

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
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  // Marquer le composant comme monté (côté client uniquement)
  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth <= 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Verrouiller le scroll du body quand le drawer est ouvert
  useEffect(() => {
    if (menuOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, isMobile]);

  // Fermer le drawer lors d'un changement de page
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Fermer le drawer avec la touche Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((v) => !v);
  }, []);

  return (
    <header className="nav-header glow-border">
      {/* ── Marque / Logo ── */}
      <Link href="/" className="nav-brand">
        <Image
          src="/images/chez-olive/chezolive-logo-mark-tight.png"
          alt="Chez Olive"
          width={66}
          height={66}
          className="nav-logo-img"
          priority
        />
        <span className="nav-brand-copy">
          <span className="nav-brand-name">{t.brandName}</span>
          <small>{language === "fr" ? "Marché local pour animaux" : "Local pet marketplace"}</small>
        </span>
      </Link>

      {/* ── Nav-body : toujours rendu, CSS gère mobile/desktop ── */}
      <div className="nav-body">
          {/* Liens principaux */}
          <nav className="nav-primary" aria-label={language === "fr" ? "Navigation principale" : "Main navigation"}>
            <Link className={`pill-link${isActive("/") ? " pill-link--active" : ""}`} href="/">
              🏠 {t.navHome}
            </Link>
            <Link className="pill-link pill-link--shop" href="/#catalogue">
              {language === "fr" ? "Magasiner" : "Shop"}
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

          {/* Séparateur */}
          <span className="nav-sep" aria-hidden="true" />

          {/* Liens secondaires */}
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

      {/* ── Mobile : panier + hamburger dans le header ── */}
      <div className="nav-mobile-right">
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

        <button
          className="nav-hamburger"
          onClick={toggleMenu}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          type="button"
        >
          <span className={`nav-hamburger-icon${menuOpen ? " open" : ""}`} />
        </button>
      </div>

      {/* ── Drawer mobile (monté côté client uniquement) ── */}
      {mounted && isMobile && (
        <>
          {/* Overlay sombre derrière le drawer */}
          <div
            className={`nav-drawer-overlay${menuOpen ? " nav-drawer-overlay--visible" : ""}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer latéral */}
          <nav
            className={`nav-drawer${menuOpen ? " nav-drawer--open" : ""}`}
            aria-label={language === "fr" ? "Menu de navigation" : "Navigation menu"}
            aria-hidden={!menuOpen}
          >
            {/* En-tête du drawer */}
            <div className="nav-drawer-header">
              <Link href="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
                <Image
                  src="/images/chez-olive/chezolive-logo-mark-tight.png"
                  alt="Chez Olive"
                  width={56}
                  height={56}
                  className="nav-logo-img"
                />
                <span className="nav-brand-copy">
                  <span className="nav-brand-name">{t.brandName}</span>
                  <small>{language === "fr" ? "Marché local" : "Local market"}</small>
                </span>
              </Link>
              <button
                className="nav-drawer-close"
                onClick={() => setMenuOpen(false)}
                aria-label={language === "fr" ? "Fermer le menu" : "Close menu"}
                type="button"
              >
                <span className="nav-drawer-close-icon" aria-hidden="true" />
              </button>
            </div>

            {/* Liens de navigation */}
            <div className="nav-drawer-links">
              <Link
                className={`nav-drawer-link${isActive("/") ? " nav-drawer-link--active" : ""}`}
                href="/"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">🏠</span>
                <span>{t.navHome}</span>
              </Link>

              <Link
                className={`nav-drawer-link${isActive("/account") ? " nav-drawer-link--active" : ""}`}
                href="/account"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">👤</span>
                <span>{t.navAccount}</span>
              </Link>

              {user?.role === "ADMIN" && (
                <Link
                  className={`nav-drawer-link nav-drawer-link--admin${isActive("/admin") ? " nav-drawer-link--active" : ""}`}
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="nav-drawer-link-icon" aria-hidden="true">⚙️</span>
                  <span>{t.navAdmin}</span>
                </Link>
              )}

              <Link
                className="nav-drawer-link nav-drawer-link--shop"
                href="/#catalogue"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">🛍️</span>
                <span>{language === "fr" ? "Magasiner" : "Shop"}</span>
              </Link>

              <Link
                className={`nav-drawer-link${isActive("/faq") ? " nav-drawer-link--active" : ""}`}
                href="/faq"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">❓</span>
                <span>{t.navFaq}</span>
              </Link>

              <div className="nav-drawer-divider" aria-hidden="true" />

              <Link
                className={`nav-drawer-link nav-drawer-link--sell${isActive("/sell") ? " nav-drawer-link--active" : ""}`}
                href="/sell"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">🌿</span>
                <span>{t.navSell}</span>
              </Link>

              <Link
                className={`nav-drawer-link nav-drawer-link--cart${isActive("/cart") ? " nav-drawer-link--active" : ""}`}
                href="/cart"
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-drawer-link-icon" aria-hidden="true">🛒</span>
                <span>
                  {language === "fr" ? "Panier" : "Cart"}
                  {cartCount > 0 && (
                    <span className="nav-drawer-cart-badge">{cartCount}</span>
                  )}
                </span>
              </Link>
            </div>

            {/* Pied du drawer : langue + déconnexion */}
            <div className="nav-drawer-footer">
              <select
                className="nav-lang-select nav-drawer-lang"
                value={language}
                disabled={langLoading}
                onChange={(e) => void onLanguageChange(e.target.value as Language)}
                aria-label={language === "fr" ? "Langue" : "Language"}
              >
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
              </select>

              {user && (
                <button
                  className="nav-drawer-logout"
                  onClick={() => void handleLogout()}
                  disabled={logoutLoading}
                  type="button"
                >
                  <span className="nav-logout-inline-icon" aria-hidden="true" />
                  <span>
                    {logoutLoading
                      ? "…"
                      : language === "fr"
                        ? "Déconnexion"
                        : "Sign out"}
                  </span>
                </button>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
