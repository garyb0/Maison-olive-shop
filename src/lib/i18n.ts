export type Language = "fr" | "en";

export const LANGUAGE_COOKIE = "maisonolive_lang";

export const dictionaries = {
  fr: {
    brandName: "Maison Olive",
    navHome: "Accueil",
    navCheckout: "Paiement",
    navAccount: "Mon compte",
    navAdmin: "Admin",
    navFaq: "FAQ",
    navTerms: "CGV",
    navReturns: "Retours",
    heroTitle: "Boutique animale bilingue, indépendante et fiable",
    heroSubtitle:
      "Nourriture, jouets et accessoires premium pour animaux, avec un espace client et admin complet.",
    catalogTitle: "Catalogue",
    addToCart: "Ajouter",
    inCart: "dans le panier",
    cart: "Panier",
    cartEmpty: "Panier vide",
    checkoutTitle: "Finaliser ma commande",
    checkoutSubtitle: "Choisis ton mode de paiement: manuel ou Stripe.",
    accountTitle: "Mon compte",
    login: "Connexion",
    register: "Inscription",
    logout: "Déconnexion",
    orderHistory: "Historique des commandes",
    reorder: "Commander à nouveau",
    adminTitle: "Administration",
    taxReport: "Rapport impôts / taxes",
    taxesExportCsv: "Exporter CSV",
    customers: "Clients",
    orders: "Commandes",
    manualPayment: "Paiement manuel",
    stripePayment: "Payer avec Stripe",
    placeOrder: "Passer la commande",
    language: "Langue",
  },
  en: {
    brandName: "Maison Olive",
    navHome: "Home",
    navCheckout: "Checkout",
    navAccount: "My account",
    navAdmin: "Admin",
    navFaq: "FAQ",
    navTerms: "Terms",
    navReturns: "Returns",
    heroTitle: "Independent bilingual pet shop, built for reliability",
    heroSubtitle:
      "Food, toys and premium accessories for pets, with complete customer and admin spaces.",
    catalogTitle: "Catalog",
    addToCart: "Add",
    inCart: "in cart",
    cart: "Cart",
    cartEmpty: "Cart is empty",
    checkoutTitle: "Complete your order",
    checkoutSubtitle: "Choose your payment mode: manual or Stripe.",
    accountTitle: "My account",
    login: "Login",
    register: "Register",
    logout: "Logout",
    orderHistory: "Order history",
    reorder: "Order again",
    adminTitle: "Admin",
    taxReport: "Tax report",
    taxesExportCsv: "Export CSV",
    customers: "Customers",
    orders: "Orders",
    manualPayment: "Manual payment",
    stripePayment: "Pay with Stripe",
    placeOrder: "Place order",
    language: "Language",
  },
} as const;

export type Dictionary = (typeof dictionaries)[Language];

export const normalizeLanguage = (value?: string | null): Language => {
  if (!value) return "fr";
  return value.toLowerCase().startsWith("en") ? "en" : "fr";
};

export const getDictionary = (language: Language): Dictionary => dictionaries[language];
