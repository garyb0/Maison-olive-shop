"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import type { Language } from "@/lib/i18n";
import { adminNavigationGroups, getAdminMobileItems, navigationLabel } from "@/lib/navigation";

type Props = {
  language: Language;
};

type NavItem = (typeof adminNavigationGroups)[number];
const navItems = adminNavigationGroups;

export function AdminSidebar({ language }: Props) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manualExpandedItems, setManualExpandedItems] = useState<string[]>([]);
  const activeParentHrefs = useMemo(() =>
    navItems
      .filter((item) => item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)))
      .map((item) => item.href),
  [pathname]);
  const expandedItems = useMemo(
    () => Array.from(new Set([...manualExpandedItems, ...activeParentHrefs])),
    [activeParentHrefs, manualExpandedItems],
  );

  const toggleExpand = (href: string) => {
    setManualExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href],
    );
  };

  const isExpanded = (href: string) => expandedItems.includes(href);
  const isActiveItem = (href: string) => pathname === href;
  const isActiveParent = (item: NavItem) =>
    item.children ? item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) : false;
  const mobileItems = useMemo(() => getAdminMobileItems(language), [language]);
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
                  <span><NavIcon name={item.icon} size={18} /></span>
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
          const label = navigationLabel(item, language);
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
                    <span className="admin-nav-icon"><NavIcon name={item.icon} size={17} /></span>
                    <span className="admin-nav-label">{label}</span>
                    <span className={`admin-nav-chevron ${expanded ? "expanded" : ""}`}>
                      {expanded ? "\u{25B2}" : "\u{25BC}"}
                    </span>
                  </button>
                  {expanded ? (
                    <ul className="admin-nav-children">
                      {(item.children ?? []).map((child) => {
                        const childLabel = navigationLabel(child, language);
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
                  <span className="admin-nav-icon"><NavIcon name={item.icon} size={17} /></span>
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
