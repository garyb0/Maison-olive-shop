'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
};

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

  const menuItems = [
    {
      icon: "🏠",
      href: "/account",
      labelFr: "Tableau de bord",
      labelEn: "Dashboard",
    },
    {
      icon: "📦",
      href: "/account/orders",
      labelFr: "Mes commandes",
      labelEn: "My orders",
    },
    {
      icon: "🐶",
      href: "/account/dogs",
      labelFr: "Mes chiens",
      labelEn: "My dogs",
    },
    {
      icon: "🔄",
      href: "/account/subscriptions",
      labelFr: "Mes abonnements",
      labelEn: "My subscriptions",
    },
    {
      icon: "👤",
      href: "/account/profile",
      labelFr: "Mon profil",
      labelEn: "My profile",
    },
    {
      icon: "❓",
      href: "/account/support",
      labelFr: "Support",
      labelEn: "Support",
    },
  ];

  return (
    <aside className="admin-sidebar account-sidebar">
      <div className="account-sidebar__header">
        <p>{language === "fr" ? "Espace client" : "Customer area"}</p>
        <strong>{language === "fr" ? "Mon Chez Olive" : "My Chez Olive"}</strong>
      </div>
      <nav className="account-sidebar__nav">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span>{item.icon}</span>
            <span>{language === "fr" ? item.labelFr : item.labelEn}</span>
          </Link>
        ))}

        <div className="account-sidebar__logout">
          <button
            className="admin-nav-item"
            style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
            type="button"
            disabled={logoutLoading}
            onClick={() => void handleLogout()}
          >
            <span>🚪</span>
            <span>
              {logoutLoading
                ? language === "fr"
                  ? "Déconnexion..."
                  : "Signing out..."
                : language === "fr"
                  ? "Déconnexion"
                  : "Logout"}
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
