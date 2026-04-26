import type { Language } from "@/lib/i18n";
import type { PromoBannerLocalized } from "@/lib/promo-banners";

export function getCatalogPreparationBanner(language: Language): PromoBannerLocalized {
  return {
    id: "catalog-preparation-banner",
    isActive: true,
    sortOrder: 0,
    badge: language === "fr" ? "Chez Olive" : "Chez Olive",
    title: language === "fr" ? "La boutique se prepare" : "The shop is getting ready",
    price1: language === "fr" ? "Les produits seront ajoutes tres bientot." : "Products will be added very soon.",
    price2:
      language === "fr"
        ? "Reviens bientot pour decouvrir la premiere selection."
        : "Come back soon to discover the first collection.",
    point1: language === "fr" ? "Compte client deja disponible" : "Customer account already available",
    point2: language === "fr" ? "Paiement deja pret" : "Checkout already prepared",
    point3: language === "fr" ? "Catalogue en cours de finalisation" : "Catalog currently being finalized",
    ctaText: language === "fr" ? "Voir mon compte" : "View my account",
    ctaLink: "/account",
  };
}
