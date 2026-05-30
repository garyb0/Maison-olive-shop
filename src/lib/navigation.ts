import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

export type NavigationIconKey =
  | "admin"
  | "app"
  | "bell"
  | "cart"
  | "catalog"
  | "customers"
  | "dashboard"
  | "delivery"
  | "dog"
  | "help"
  | "home"
  | "location"
  | "orders"
  | "profile"
  | "promo"
  | "security"
  | "search"
  | "stock"
  | "subscriptions"
  | "support"
  | "taxes";

export type NavigationItem = {
  href: string;
  icon: NavigationIconKey;
  labelFr: string;
  labelEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
  requireRole?: UserRole;
};

export type NavigationGroup = {
  id: string;
  icon: NavigationIconKey;
  labelFr: string;
  labelEn: string;
  href: string;
  children?: NavigationItem[];
};

export function navigationLabel(item: Pick<NavigationItem, "labelFr" | "labelEn">, language: Language) {
  return language === "fr" ? item.labelFr : item.labelEn;
}

export function navigationDescription(
  item: Pick<NavigationItem, "descriptionFr" | "descriptionEn">,
  language: Language,
) {
  return language === "fr" ? item.descriptionFr : item.descriptionEn;
}

export const publicNavigationItems: NavigationItem[] = [
  {
    href: "/?home=1",
    icon: "home",
    labelFr: "Accueil",
    labelEn: "Home",
    descriptionFr: "Retour a la vitrine Chez Olive.",
    descriptionEn: "Return to the Chez Olive storefront.",
  },
  {
    href: "/boutique",
    icon: "catalog",
    labelFr: "Boutique",
    labelEn: "Shop",
    descriptionFr: "Produits, categories et recherche.",
    descriptionEn: "Products, categories, and search.",
  },
  {
    href: "/app",
    icon: "app",
    labelFr: "App",
    labelEn: "App",
    descriptionFr: "Raccourcis client, commandes et notifications.",
    descriptionEn: "Customer shortcuts, orders, and notifications.",
  },
  {
    href: "/faq",
    icon: "help",
    labelFr: "Aide",
    labelEn: "Help",
    descriptionFr: "Livraison, retours et support.",
    descriptionEn: "Delivery, returns, and support.",
  },
];

export const appNavigationItems: NavigationItem[] = [
  { href: "/app", icon: "home", labelFr: "Accueil", labelEn: "Home" },
  { href: "/boutique", icon: "catalog", labelFr: "Boutique", labelEn: "Shop" },
  { href: "/account/orders", icon: "orders", labelFr: "Commandes", labelEn: "Orders" },
  { href: "/account/support", icon: "support", labelFr: "Support", labelEn: "Support" },
  { href: "/account", icon: "profile", labelFr: "Compte", labelEn: "Account" },
];

export const accountNavigationItems: NavigationItem[] = [
  { href: "/account", icon: "dashboard", labelFr: "Tableau de bord", labelEn: "Dashboard" },
  { href: "/account/orders", icon: "orders", labelFr: "Mes commandes", labelEn: "My orders" },
  { href: "/account/dogs", icon: "dog", labelFr: "Chiens QR", labelEn: "QR dogs" },
  { href: "/account/subscriptions", icon: "subscriptions", labelFr: "Abonnements", labelEn: "Subscriptions" },
  { href: "/account/profile", icon: "profile", labelFr: "Profil et securite", labelEn: "Profile and security" },
  { href: "/account/support", icon: "support", labelFr: "Support", labelEn: "Support" },
];

export const adminNavigationGroups: NavigationGroup[] = [
  {
    id: "dashboard",
    href: "/admin",
    icon: "dashboard",
    labelFr: "Tableau de bord",
    labelEn: "Dashboard",
  },
  {
    id: "sales",
    href: "/admin/orders",
    icon: "orders",
    labelFr: "Ventes",
    labelEn: "Sales",
    children: [
      { href: "/admin/orders", icon: "orders", labelFr: "Commandes", labelEn: "Orders" },
      { href: "/admin/promo", icon: "promo", labelFr: "Promotions", labelEn: "Promotions" },
      { href: "/admin/taxes", icon: "taxes", labelFr: "Taxes", labelEn: "Taxes" },
    ],
  },
  {
    id: "catalog",
    href: "/admin/products",
    icon: "catalog",
    labelFr: "Catalogue",
    labelEn: "Catalog",
    children: [
      { href: "/admin/products", icon: "stock", labelFr: "Produits et stock", labelEn: "Products and stock" },
      { href: "/admin/dogs", icon: "dog", labelFr: "Chiens QR", labelEn: "Dog QR" },
    ],
  },
  {
    id: "delivery",
    href: "/admin/delivery",
    icon: "delivery",
    labelFr: "Livraison",
    labelEn: "Delivery",
    children: [
      { href: "/admin/delivery", icon: "delivery", labelFr: "Creneaux", labelEn: "Slots" },
      { href: "/admin/delivery/runs", icon: "location", labelFr: "Tournees", labelEn: "Runs" },
    ],
  },
  {
    id: "customers",
    href: "/admin/customers",
    icon: "customers",
    labelFr: "Relation client",
    labelEn: "Customer care",
    children: [
      { href: "/admin/customers", icon: "customers", labelFr: "Clients", labelEn: "Customers" },
      { href: "/admin/support", icon: "support", labelFr: "Support", labelEn: "Support" },
      { href: "/admin/support/settings", icon: "bell", labelFr: "Reglages support", labelEn: "Support settings" },
    ],
  },
  {
    id: "ops",
    href: "/admin/maintenance-cloudflare",
    icon: "security",
    labelFr: "Ops",
    labelEn: "Ops",
    children: [
      { href: "/admin/maintenance-cloudflare", icon: "security", labelFr: "Maintenance", labelEn: "Maintenance" },
    ],
  },
];

export function getAdminMobileItems(language: Language) {
  return adminNavigationGroups.flatMap((group) => {
    const parent = {
      href: group.href,
      icon: group.icon,
      label: navigationLabel(group, language),
    };
    const children = (group.children ?? []).map((child) => ({
      href: child.href,
      icon: child.icon,
      label: navigationLabel(child, language),
    }));
    return [parent, ...children.filter((child) => child.href !== group.href)];
  });
}
