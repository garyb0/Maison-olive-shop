"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sanitizePromoCtaLink } from "@/lib/promo-links";

type PromoBannerData = {
  id: string;
  isActive: boolean;
  sortOrder: number;
  badge: string;
  title: string;
  price1: string;
  price2: string;
  point1: string;
  point2: string;
  point3: string;
  ctaText: string;
  ctaLink: string;
};

type Props = {
  banners?: PromoBannerData[];
};

const ROTATION_INTERVAL_MS = 25000;

const FALLBACK_BANNERS: PromoBannerData[] = [
  {
    id: "local-delivery",
    isActive: true,
    sortOrder: 0,
    badge: "Rimouski et environs",
    title: "Livraison locale simple pour les essentiels de ton chien",
    price1: "Gratuite dès 75 $ CAD",
    price2: "Commande facile, sans surprise",
    point1: "Zone locale desservie",
    point2: "Support humain Chez Olive",
    point3: "Parfait pour les achats du quotidien",
    ctaText: "Magasiner",
    ctaLink: "/",
  },
  {
    id: "food-soon",
    isActive: true,
    sortOrder: 1,
    badge: "Bientôt chez Olive",
    title: "Une section nourriture se prépare tranquillement",
    price1: "Sélection pratique pour le local",
    price2: "Toujours avec notre livraison à domicile",
    point1: "Essentiels pour aujourd'hui",
    point2: "Alimentation à venir",
    point3: "Même expérience simple et locale",
    ctaText: "Voir les produits",
    ctaLink: "/",
  },
];

export function LocalPromoBanner({ banners = [] }: Props) {
  const active = banners.filter((banner) => banner.isActive);
  const activeBanners = (active.length > 0 ? active : FALLBACK_BANNERS).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const interval = setInterval(() => {
      if (!isPaused) {
        setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
      }
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeBanners.length, isPaused]);

  const current = activeBanners[currentIndex] ?? activeBanners[0];
  const currentCtaLink = sanitizePromoCtaLink(current.ctaLink);

  return (
    <div
      className="promo-banner glow-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="promo-banner-visual" aria-hidden="true">
        🧺
      </div>

      <div className="promo-banner-content">
        <span className="promo-banner-badge">{current.badge}</span>
        <h2 className="promo-banner-title">{current.title}</h2>
        <div className="promo-banner-offer">
          <span className="promo-banner-price-single">{current.price1}</span>
          <span className="promo-banner-price-deal">{current.price2}</span>
        </div>
        <div className="promo-banner-points">
          <span>✅ {current.point1}</span>
          <span>✅ {current.point2}</span>
          <span>✅ {current.point3}</span>
        </div>
      </div>

      <div className="promo-banner-cta">
        <Link href={currentCtaLink} className="promo-banner-btn">
          {current.ctaText} →
        </Link>
      </div>

      {activeBanners.length > 1 ? (
        <div className="promo-banner-dots">
          {activeBanners.map((banner, index) => (
            <button
              key={banner.id}
              className={`promo-banner-dot ${index === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Bannière ${index + 1}`}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
