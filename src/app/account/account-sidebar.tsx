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

function isAccountNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebar({ language }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

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
    </aside>
  );
}
