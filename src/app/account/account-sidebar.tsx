'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import type { Language } from "@/lib/i18n";
import { accountNavigationItems, navigationLabel } from "@/lib/navigation";

type Props = {
  language: Language;
};

const primaryMobileHrefs = ["/account", "/account/orders", "/account/dogs"];
const moreMobileHrefs = ["/account/subscriptions", "/account/profile", "/account/support"];

function isAccountNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function mobileNavigationLabel(href: string, language: Language) {
  const labels: Record<string, { fr: string; en: string }> = {
    "/account": { fr: "Tableau", en: "Dashboard" },
    "/account/orders": { fr: "Commandes", en: "Orders" },
    "/account/dogs": { fr: "Chiens QR", en: "QR dogs" },
  };
  const item = labels[href];
  if (!item) return null;
  return language === "fr" ? item.fr : item.en;
}

export function AccountSidebar({ language }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const primaryMobileItems = accountNavigationItems.filter((item) => primaryMobileHrefs.includes(item.href));
  const moreMobileItems = accountNavigationItems.filter((item) => moreMobileHrefs.includes(item.href));
  const activeMoreItem = moreMobileItems.find((item) => isAccountNavActive(pathname, item.href)) ?? null;
  const moreLabel = activeMoreItem
    ? navigationLabel(activeMoreItem, language)
    : language === "fr"
      ? "Plus compte"
      : "More account";

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <aside className="admin-sidebar account-sidebar">
      <div className="account-sidebar__header">
        <p>{language === "fr" ? "Espace client" : "Customer area"}</p>
        <strong>{language === "fr" ? "Mon Chez Olive" : "My Chez Olive"}</strong>
      </div>
      <nav className="account-sidebar__nav account-sidebar__nav--desktop">
        {accountNavigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-item ${isAccountNavActive(pathname, item.href) ? "active" : ""}`}
          >
            <span className="admin-nav-icon"><NavIcon name={item.icon} size={17} /></span>
            <span>{navigationLabel(item, language)}</span>
          </Link>
        ))}

        <div className="account-sidebar__logout">
          <button
            className="admin-nav-item account-sidebar__logout-button"
            type="button"
            disabled={logoutLoading}
            onClick={() => void handleLogout()}
          >
            <span className="admin-nav-icon"><NavIcon name="security" size={17} /></span>
            <span>
              {logoutLoading
                ? language === "fr"
                  ? "Déconnexion..."
                  : "Signing out..."
                : language === "fr"
                  ? "Déconnexion du compte"
                  : "Sign out of account"}
            </span>
          </button>
        </div>
      </nav>
      <nav className="account-mobile-account-nav" aria-label={language === "fr" ? "Navigation compte" : "Account navigation"}>
        {primaryMobileItems.map((item) => (
          <Link
            className={`account-mobile-account-tab${isAccountNavActive(pathname, item.href) ? " account-mobile-account-tab--active" : ""}`}
            href={item.href}
            key={`mobile-${item.href}`}
          >
            <NavIcon name={item.icon} size={17} />
            <span>{mobileNavigationLabel(item.href, language) ?? navigationLabel(item, language)}</span>
          </Link>
        ))}

        <details className={`account-mobile-account-more${activeMoreItem ? " account-mobile-account-more--active" : ""}`}>
          <summary className="account-mobile-account-more__trigger">
            <NavIcon name={activeMoreItem?.icon ?? "profile"} size={17} />
            <span>{moreLabel}</span>
          </summary>
          <div className="account-mobile-account-more__menu">
            {moreMobileItems.map((item) => (
              <Link
                className={`account-mobile-account-more__item${isAccountNavActive(pathname, item.href) ? " account-mobile-account-more__item--active" : ""}`}
                href={item.href}
                key={`mobile-more-${item.href}`}
              >
                <NavIcon name={item.icon} size={17} />
                <span>{navigationLabel(item, language)}</span>
              </Link>
            ))}
            <button
              className="account-mobile-account-more__item account-mobile-account-more__item--logout"
              type="button"
              disabled={logoutLoading}
              onClick={() => void handleLogout()}
            >
              <NavIcon name="security" size={17} />
              <span>
                {logoutLoading
                  ? language === "fr"
                    ? "Déconnexion..."
                    : "Signing out..."
                  : language === "fr"
                    ? "Déconnexion du compte"
                    : "Sign out of account"}
              </span>
            </button>
          </div>
        </details>
      </nav>
    </aside>
  );
}
