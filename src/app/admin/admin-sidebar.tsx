"use client";

import { useEffect, useMemo, useState } from "react";
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
  { href: "/admin", icon: "DB", labelFr: "Tableau de bord", labelEn: "Dashboard" },
  { href: "/admin/products", icon: "PR", labelFr: "Produits", labelEn: "Products" },
  { href: "/admin/orders", icon: "CO", labelFr: "Commandes", labelEn: "Orders" },
  {
    href: "/admin/delivery",
    icon: "LV",
    labelFr: "Livraisons",
    labelEn: "Delivery",
    children: [
      { href: "/admin/delivery", labelFr: "Créneaux", labelEn: "Slots" },
      { href: "/admin/delivery/runs", labelFr: "Tournées", labelEn: "Runs" },
    ],
  },
  { href: "/admin/customers", icon: "CL", labelFr: "Clients", labelEn: "Customers" },
  { href: "/admin/dogs", icon: "QR", labelFr: "Chiens QR", labelEn: "Dog QR" },
  { href: "/admin/taxes", icon: "TX", labelFr: "Taxes", labelEn: "Taxes" },
  { href: "/admin/promo", icon: "%", labelFr: "Promotions", labelEn: "Promotions" },
  {
    href: "/admin/support",
    icon: "SP",
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (pathname.startsWith("/admin/delivery")) {
      return ["/admin/delivery"];
    }
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
  const mobileItems = useMemo(() => navItems.flatMap((item) => {
    const parentLabel = language === "fr" ? item.labelFr : item.labelEn;
    const parent = { href: item.href, icon: item.icon, label: parentLabel };
    const children = (item.children ?? []).map((child) => ({
      href: child.href,
      icon: item.icon,
      label: language === "fr" ? child.labelFr : child.labelEn,
    }));
    return [parent, ...children.filter((child) => child.href !== item.href)];
  }), [language]);
  const currentLabel = useMemo(() => {
    const exact = mobileItems.find((item) => item.href === pathname);
    if (exact) return exact.label;
    const fallback = [...mobileItems]
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => pathname.startsWith(`${item.href}/`));
    return fallback?.label ?? (language === "fr" ? "Tableau de bord" : "Dashboard");
  }, [language, mobileItems, pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => setMobileMenuOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="admin-sidebar admin-sidebar--main">
      <div className="admin-mobile-bar">
        <div>
          <span>{language === "fr" ? "Admin" : "Admin"}</span>
          <strong>{currentLabel}</strong>
        </div>
        <button
          className="admin-mobile-menu-button"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-drawer"
          onClick={() => setMobileMenuOpen(true)}
        >
          Menu
        </button>
      </div>

      <div
        className={`admin-mobile-overlay${mobileMenuOpen ? " admin-mobile-overlay--visible" : ""}`}
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        id="admin-mobile-drawer"
        className={`admin-mobile-drawer${mobileMenuOpen ? " admin-mobile-drawer--open" : ""}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="admin-mobile-drawer__head">
          <div>
            <span>{language === "fr" ? "Navigation" : "Navigation"}</span>
            <strong>Administration</strong>
          </div>
          <button
            className="admin-mobile-drawer__close"
            type="button"
            aria-label={language === "fr" ? "Fermer le menu admin" : "Close admin menu"}
            onClick={() => setMobileMenuOpen(false)}
          >
            x
          </button>
        </div>
        <ul className="admin-mobile-drawer__nav">
          {mobileItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className={`admin-mobile-drawer__link${active ? " active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{item.icon}</span>
                  <strong>{item.label}</strong>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

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
