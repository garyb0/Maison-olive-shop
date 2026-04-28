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
        ? "Livraison locale simple et claire, avec suivi dans ton espace client."
        : "Simple local delivery, with follow-up in your customer account.",
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
                ? "Le marché local pour les humains et leurs compagnons."
                : "The local market for humans and their companions."}
            </h2>
            <p className="site-footer__text">
              {language === "fr"
                ? "Produits sélectionnés, livraison locale, aide et suivi dans une expérience simple, chaleureuse et cohérente."
                : "Selected products, local delivery, support, and follow-up in one simple, warm, and consistent experience."}
            </p>
          </div>

          <div className="site-footer__grid">
            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Navigation" : "Navigation"}
              </p>
              <div className="site-footer__links">
                <Link href={HOME_HREF}>{t.navHome}</Link>
                <Link href="/boutique">{language === "fr" ? "Boutique" : "Shop"}</Link>
                <Link href="/faq">{language === "fr" ? "Centre d’aide" : "Help center"}</Link>
                <Link href="/shipping">{language === "fr" ? "Livraison" : "Shipping"}</Link>
                <Link href="/sell">{t.navSell}</Link>
              </div>
            </div>

            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Informations" : "Information"}
              </p>
              <div className="site-footer__links">
                <Link href="/returns">{language === "fr" ? "Retours et remboursements" : "Returns and refunds"}</Link>
                <Link href="/terms">{language === "fr" ? "Conditions de vente" : "Terms of sale"}</Link>
                <Link href="/account">{t.navAccount}</Link>
                <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>
              </div>
            </div>

            <div className="site-footer__card">
              <p className="site-footer__card-label">
                {language === "fr" ? "Support" : "Support"}
              </p>
              <div className="site-footer__meta">
                <strong>{language === "fr" ? "Besoin d’aide ?" : "Need help?"}</strong>
                <span>{business.supportHours}</span>
                <span>{business.shippingPolicy}</span>
              </div>
            </div>
          </div>

          <div className="site-footer__bottom">
            <span>
              © {new Date().getFullYear()} Chez Olive
            </span>
            <span>
              {language === "fr"
                ? "Boutique animalière locale"
                : "Local pet boutique"}
            </span>
          </div>
        </section>
      </div>
    </footer>
  );
}
