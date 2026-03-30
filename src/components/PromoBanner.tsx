import Link from "next/link";

/**
 * PromoBanner — Bandeau promotionnel pour le lit pour chien
 * Apparaît sous le header sur toutes les pages.
 */
export function PromoBanner() {
  return (
    <div className="promo-banner">
      {/* Visuel produit */}
      <div className="promo-banner-visual" aria-hidden="true">
        🛏️
      </div>

      {/* Contenu textuel */}
      <div className="promo-banner-content">
        <span className="promo-banner-badge">🔥 Offre limitée</span>
        <h2 className="promo-banner-title">🐾 Confort Premium pour ton chien</h2>
        <div className="promo-banner-offer">
          <span className="promo-banner-price-single">1 pour 64,99&nbsp;$</span>
          <span className="promo-banner-price-deal">🔥 2 pour seulement 100&nbsp;$</span>
        </div>
        <div className="promo-banner-points">
          <span>✔ Ultra doux</span>
          <span>✔ Lavable</span>
          <span>✔ Approuvé par Olive</span>
        </div>
      </div>

      {/* Bouton CTA */}
      <div className="promo-banner-cta">
        <Link href="/" className="promo-banner-btn">
          Magasiner&nbsp;→
        </Link>
      </div>
    </div>
  );
}
