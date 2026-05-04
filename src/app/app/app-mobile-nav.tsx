"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

type Props = {
  language: Language;
  userRole: UserRole | null;
};

export function AppMobileNav({ language, userRole }: Props) {
  const [driverHref, setDriverHref] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = window.localStorage.getItem("chezolive_last_driver_run_href");
      if (saved?.startsWith("/driver/run/")) {
        setDriverHref(saved);
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const items = [
    { href: "/boutique", label: language === "fr" ? "Boutique" : "Shop" },
    { href: "/cart", label: language === "fr" ? "Panier" : "Cart" },
    { href: "/account/orders", label: language === "fr" ? "Commandes" : "Orders" },
    { href: "/account/dogs", label: language === "fr" ? "Chiens" : "Dogs" },
    { href: "/account/support", label: "Support" },
  ];

  if (driverHref) {
    items.push({ href: driverHref, label: language === "fr" ? "Livreur" : "Driver" });
  }

  if (userRole === "ADMIN") {
    items.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav className="pwa-app-nav" aria-label={language === "fr" ? "Navigation application" : "App navigation"}>
      {items.map((item) => (
        <Link href={item.href} key={`${item.href}-${item.label}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
