"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
};

type NavItem = {
  href: string;
  icon: string;
  labelFr: string;
  labelEn: string;
  children?: Array<{ href: string; labelFr: string; labelEn: string }>;
};

const navItems: NavItem[] = [
  { href: "/admin", icon: "\u{1F3E2}", labelFr: "Tableau de bord", labelEn: "Dashboard" },
  { href: "/admin/products", icon: "\u{1F6D2}", labelFr: "Produits", labelEn: "Products" },
  { href: "/admin/orders", icon: "\u{1F4E6}", labelFr: "Commandes", labelEn: "Orders" },
  {
    href: "/admin/delivery",
    icon: "\u{1F69A}",
    labelFr: "Livraisons",
    labelEn: "Delivery",
    children: [
      { href: "/admin/delivery", labelFr: "Créneaux", labelEn: "Slots" },
      { href: "/admin/delivery/runs", labelFr: "Tournées", labelEn: "Runs" },
    ],
  },
  { href: "/admin/customers", icon: "\u{1F465}", labelFr: "Clients", labelEn: "Customers" },
  { href: "/admin/dogs", icon: "\u{1F436}", labelFr: "Chiens QR", labelEn: "Dog QR" },
  { href: "/admin/taxes", icon: "\u{1F4B0}", labelFr: "Taxes", labelEn: "Taxes" },
  { href: "/admin/promo", icon: "\u{1F4E3}", labelFr: "Promotions", labelEn: "Promotions" },
  {
    href: "/admin/support",
    icon: "\u{1F4AC}",
    labelFr: "Support",
    labelEn: "Support",
    children: [
      { href: "/admin/support", labelFr: "Conversations", labelEn: "Conversations" },
      { href: "/admin/support/settings", labelFr: "Paramètres", labelEn: "Settings" },
    ],
  },
];

export function AdminSidebar({ language }: Props) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (pathname.startsWith("/admin/support")) {
      return ["/admin/support"];
    }
    return [];
  });

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href],
    );
  };

  const isExpanded = (href: string) => expandedItems.includes(href);
  const isActiveItem = (href: string) => pathname === href;
  const isActiveParent = (item: NavItem) =>
    item.children ? item.children.some((child) => pathname === child.href) : false;

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-header">
        <h2>{language === "fr" ? "Administration" : "Administration"}</h2>
      </div>
      <ul className="admin-sidebar-nav">
        {navItems.map((item) => {
          const label = language === "fr" ? item.labelFr : item.labelEn;
          const hasChildren = item.children && item.children.length > 0;
          const expanded = isExpanded(item.href);
          const active = isActiveItem(item.href) || isActiveParent(item);

          return (
            <li key={item.href} className={hasChildren ? "admin-nav-group" : ""}>
              {hasChildren ? (
                <>
                  <button
                    className={`admin-nav-item admin-nav-expandable ${active ? "active" : ""}`}
                    onClick={() => toggleExpand(item.href)}
                    aria-expanded={expanded}
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span className="admin-nav-label">{label}</span>
                    <span className={`admin-nav-chevron ${expanded ? "expanded" : ""}`}>
                      {expanded ? "\u{25B2}" : "\u{25BC}"}
                    </span>
                  </button>
                  {expanded ? (
                    <ul className="admin-nav-children">
                      {(item.children ?? []).map((child) => {
                        const childLabel = language === "fr" ? child.labelFr : child.labelEn;
                        const childActive = isActiveItem(child.href);

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`admin-nav-child-item ${childActive ? "active" : ""}`}
                            >
                              <span className="admin-nav-child-dot" />
                              <span className="admin-nav-label">{childLabel}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </>
              ) : (
                <Link href={item.href} className={`admin-nav-item ${active ? "active" : ""}`}>
                  <span className="admin-nav-icon">{item.icon}</span>
                  <span className="admin-nav-label">{label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
