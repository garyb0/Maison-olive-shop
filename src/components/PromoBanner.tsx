"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Language } from "@/lib/i18n";
import { sanitizePromoCtaLink } from "@/lib/promo-links";
import type { PromoBannerLocalized } from "@/lib/promo-banners";

type Props = {
  language?: Language;
  banners?: PromoBannerLocalized[];
};

const ROTATION_INTERVAL_MS = 25000;

const fallbackBanner = (language: Language): PromoBannerLocalized => ({
  id: "fallback-banner",
  isActive: true,
  sortOrder: 0,
  badge: language === "fr" ? "🔥 Offre limitée" : "🔥 Limited offer",
  title: language === "fr" ? "🐾 Confort premium pour ton chien" : "🐾 Premium comfort for your dog",
  price1: language === "fr" ? "1 pour 64,99 $" : "1 for $64.99",
  price2: language === "fr" ? "🔥 2 pour seulement 100 $" : "🔥 2 for only $100",
  point1: language === "fr" ? "Ultra doux" : "Ultra soft",
  point2: language === "fr" ? "Lavable" : "Washable",
  point3: language === "fr" ? "Approuvé par Olive" : "Olive approved",
  ctaText: language === "fr" ? "Magasiner →" : "Shop now →",
  ctaLink: "/",
});

/**
 * PromoBanner — Carrousel de bannières promotionnelles
 * Apparaît sous le header sur toutes les pages.
 * Défilement automatique toutes les 25 secondes si plusieurs bannières actives.
 */
export function PromoBanner({ language = "fr", banners = [] }: Props) {
  const [remoteBanners, setRemoteBanners] = useState<PromoBannerLocalized[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (banners.length > 0) return;

    let ignore = false;

    const loadBanners = async () => {
      try {
        const res = await fetch(`/api/promo-banners?lang=${language}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          banners?: PromoBannerLocalized[];
        };

        if (!res.ok || ignore) return;
        setRemoteBanners(Array.isArray(data.banners) ? data.banners : []);
      } catch {
        if (!ignore) {
          setRemoteBanners([]);
        }
      }
    };

    void loadBanners();

    return () => {
      ignore = true;
    };
  }, [banners, language]);

  const activeBanners = useMemo(() => {
    const source = banners.length > 0 ? banners : remoteBanners;
    const active = source.filter((banner) => banner.isActive);
    return active.length > 0 ? active : [fallbackBanner(language)];
  }, [banners, remoteBanners, language]);
  const boundedIndex = currentIndex % activeBanners.length;

  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (!isPaused) {
        setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
      }
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeBanners.length, isPaused]);

  // Pas de bannière active — on affiche le fallback par défaut
  if (activeBanners.length === 0) {
    return (
      <div className="promo-banner glow-border">
        <div className="promo-banner-visual" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/chez-olive/olive-head.png" alt="" />
        </div>
        <div className="promo-banner-content">
          <span className="promo-banner-badge">🔥 Offre limitée</span>
          <h2 className="promo-banner-title">🐾 Confort Premium pour ton chien</h2>
          <div className="promo-banner-offer">
            <span className="promo-banner-price-single promo-banner-price-single--strike">1 pour 64,99&nbsp;$</span>
            <span className="promo-banner-price-deal">🔥 2 pour seulement 100&nbsp;$</span>
          </div>
          <div className="promo-banner-points">
            <span>✔ Ultra doux</span>
            <span>✔ Lavable</span>
            <span>✔ Approuvé par Olive</span>
          </div>
        </div>
        <div className="promo-banner-cta">
          <Link href="/" className="promo-banner-btn">Magasiner&nbsp;→</Link>
        </div>
      </div>
    );
  }

  const current = activeBanners[boundedIndex];
  const currentCtaLink = sanitizePromoCtaLink(current.ctaLink);
  const price1 = current.price1.trim();
  const price2 = current.price2.trim();
  const price1LooksLikePrice = /[\d$]/.test(price1);

  return (
    <div
      className="promo-banner glow-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Visuel produit */}
      <div className="promo-banner-visual" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/chez-olive/olive-head.png" alt="" />
      </div>

      {/* Contenu textuel */}
      <div className="promo-banner-content">
        <span className="promo-banner-badge">{current.badge}</span>
        <h2 className="promo-banner-title">{current.title}</h2>
        {price1 || price2 ? (
          <div className="promo-banner-offer">
            {price1 ? (
              <span className={`promo-banner-price-single${price1LooksLikePrice ? " promo-banner-price-single--strike" : ""}`}>
                {price1}
              </span>
            ) : null}
            {price2 ? <span className="promo-banner-price-deal">{price2}</span> : null}
          </div>
        ) : null}
        <div className="promo-banner-points">
          <span>✔ {current.point1}</span>
          <span>✔ {current.point2}</span>
          <span>✔ {current.point3}</span>
        </div>
      </div>

      {/* Bouton CTA */}
      <div className="promo-banner-cta">
        <Link href={currentCtaLink} className="promo-banner-btn">
          {current.ctaText}
        </Link>
      </div>

      {/* Indicateurs de carrousel */}
      {activeBanners.length > 1 && (
        <div className="promo-banner-dots">
          {activeBanners.map((_, index) => (
            <button
              key={index}
              className={`promo-banner-dot ${index === boundedIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={language === "fr" ? `Bannière ${index + 1}` : `Banner ${index + 1}`}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}
