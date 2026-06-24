"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDictionary, normalizeLanguage, type Language } from "@/lib/i18n";

const HOME_HREF = "/?home=1";

function getClientLanguage() {
  if (typeof document === "undefined") return "fr" as const;
  const match = document.cookie.match(/chezolive_lang=([^;]+)/);
  return normalizeLanguage(match?.[1]);
}

export function SiteFooter() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("fr");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setLanguage(getClientLanguage());
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const t = getDictionary(language);
  const business = {
    supportEmail: "support@chezolive.ca",
    supportHours:
      language === "fr"
        ? "Lundi au vendredi, 9h à 17h (heure de Montréal)"
        : "Monday to Friday, 9am to 5pm (Montreal time)",
    shippingPolicy:
      language === "fr"
        ? "Livraison à domicile à Rimouski et environs. Les frais et le seuil gratuit sont confirmés au panier et au passage à la caisse."
        : "Home delivery in Rimouski and nearby areas. Fees and the free-delivery threshold are confirmed in cart and checkout.",
  };

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="site-footer-wrap">
      <div className="app-shell">
        <section className="site-footer">
          <div className="site-footer__brand">
            <div className="site-footer__mascot" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/chez-olive/chezolive-logo-full.png" alt="" />
            </div>
            <p className="site-footer__eyebrow">
              {language === "fr" ? "Chez Olive" : "Chez Olive"}
            </p>
            <h2 className="site-footer__title">
              {language === "fr"
                ? "De notre famille à la vôtre."
                : "From our family to yours."}
            </h2>
            <p className="site-footer__text">
              {language === "fr"
                ? "Une boutique animalière locale, des produits choisis avec soin et la livraison à domicile à Rimouski."
                : "A local pet boutique with carefully chosen products and home delivery in Rimouski."}
            </p>
          </div>

          <div className="site-footer__grid">
            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Navigation" : "Navigation"}
              </p>
              <div className="site-footer__links">
                <Link href={HOME_HREF}>{t.navHome}</Link>
                <Link href="/app">{language === "fr" ? "Application" : "App"}</Link>
                <Link href="/boutique">{language === "fr" ? "Boutique" : "Shop"}</Link>
                <Link href="/faq">{language === "fr" ? "Centre d'aide" : "Help center"}</Link>
                <Link href="/faq#livraison">{language === "fr" ? "Livraison" : "Shipping"}</Link>
              </div>
            </div>

            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Informations" : "Information"}
              </p>
              <div className="site-footer__links">
                <Link href="/faq#retours">{language === "fr" ? "Retours et remboursements" : "Returns and refunds"}</Link>
                <Link href="/terms">{language === "fr" ? "Conditions" : "Terms"}</Link>
                <Link href="/privacy">{language === "fr" ? "Confidentialité" : "Privacy"}</Link>
                <Link href="/data-deletion">{language === "fr" ? "Suppression des données" : "Data deletion"}</Link>
                <Link href="/account">{t.navAccount}</Link>
                <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>
              </div>
            </div>

            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Support" : "Support"}
              </p>
              <div className="site-footer__meta">
                <strong>{language === "fr" ? "Besoin d'aide ?" : "Need help?"}</strong>
                <span>{business.supportHours}</span>
                <span>{business.shippingPolicy}</span>
              </div>
            </div>

            <div className="site-footer__card site-footer__card--app">
              <p className="site-footer__card-label">
                {language === "fr" ? "App mobile" : "Mobile app"}
              </p>
              <div className="site-footer__meta">
                <strong>{language === "fr" ? "Installer Chez Olive" : "Install Chez Olive"}</strong>
                <span>
                  {language === "fr"
                    ? "Android: app Google Play en préparation. iPhone: Partager > Sur l'écran d'accueil."
                    : "Android: Google Play app in preparation. iPhone: Share > Add to Home Screen."}
                </span>
                <Link href="/app">{language === "fr" ? "Ouvrir l'app" : "Open the app"}</Link>
              </div>
            </div>
          </div>

          <div className="site-footer__bottom">
            <span>&copy; {new Date().getFullYear()} Chez Olive</span>
            <span>
              {language === "fr"
                ? "De notre famille à la vôtre"
                : "From our family to yours"}
            </span>
          </div>
        </section>
      </div>
    </footer>
  );
}
