"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary, Language } from "@/lib/i18n";

type Props = {
  language: Language;
  t: Dictionary;
};

type NavItem = {
  href: string;
  icon: string;
  labelFr: string;
  labelEn: string;
  children?: Array<{ href: string; labelFr: string; labelEn: string }>;
};

const navItems: NavItem[] = [
  { href: "/admin", icon: "🏠", labelFr: "Dashboard", labelEn: "Dashboard" },
  { href: "/admin/products", icon: "📦", labelFr: "Produits", labelEn: "Products" },
  { href: "/admin/orders", icon: "🛒", labelFr: "Commandes", labelEn: "Orders" },
  { href: "/admin/customers", icon: "👥", labelFr: "Clients", labelEn: "Customers" },
  { href: "/admin/taxes", icon: "💰", labelFr: "Taxes", labelEn: "Taxes" },
  { href: "/admin/promo", icon: "🏷️", labelFr: "Bannières", labelEn: "Banners" },
  {
    href: "/admin/support",
    icon: "💬",
    labelFr: "Support",
    labelEn: "Support",
    children: [
      { href: "/admin/support", labelFr: "Conversations", labelEn: "Conversations" },
      { href: "/admin/support/settings", labelFr: "Paramètres", labelEn: "Settings" },
    ],
  },
];

export function AdminSidebar({ language, t }: Props) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Auto-expand if we're on a support page
    if (pathname.startsWith("/admin/support")) {
      return ["/admin/support"];
    }
    return [];
  });

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href]
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
                      ▸
                    </span>
                  </button>
                  {expanded && (
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
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`admin-nav-item ${active ? "active" : ""}`}
                >
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
