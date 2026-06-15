"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";
import { appNavigationItems, navigationLabel } from "@/lib/navigation";

type Props = {
  language: Language;
  userRole: UserRole | null;
  className?: string;
  showSecondary?: boolean;
};

const accountSecondaryPaths = ["/account/dogs", "/account/profile", "/account/subscriptions"];

function isExactOrChildPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getLoginHrefForReturnTo(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function isAppNavigationItemActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app";
  }

  if (href === "/boutique") {
    return isExactOrChildPath(pathname, "/boutique") || pathname.startsWith("/products/");
  }

  if (href === "/account/orders") {
    return isExactOrChildPath(pathname, "/account/orders");
  }

  if (href === "/account/support") {
    return pathname === "/account/support";
  }

  if (href === "/account") {
    return pathname === "/account" || accountSecondaryPaths.some((accountPath) => isExactOrChildPath(pathname, accountPath));
  }

  return isExactOrChildPath(pathname, href);
}

export function AppMobileNav({ language, userRole, className, showSecondary = true }: Props) {
  const pathname = usePathname() ?? "";
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

  const items = appNavigationItems.map((item) => {
    const requiresAccount = item.href.startsWith("/account");
    return {
      ...item,
      originalHref: item.href,
      targetHref: requiresAccount && !userRole ? getLoginHrefForReturnTo(item.href) : item.href,
      label: navigationLabel(item, language),
    };
  });

  return (
    <nav className={`pwa-app-nav${className ? ` ${className}` : ""}`} aria-label={language === "fr" ? "Navigation application" : "App navigation"}>
      {items.map((item) => (
        <Link
          className={isAppNavigationItemActive(pathname, item.originalHref) ? "active" : ""}
          href={item.targetHref}
          key={`${item.originalHref}-${item.label}`}
        >
          <NavIcon name={item.icon} size={19} />
          <span>{item.label}</span>
        </Link>
      ))}
      {showSecondary && driverHref ? (
        <Link className="pwa-app-nav__secondary" href={driverHref}>
          <NavIcon name="delivery" size={19} />
          <span>{language === "fr" ? "Livreur" : "Driver"}</span>
        </Link>
      ) : null}
      {showSecondary && userRole === "ADMIN" ? (
        <Link className="pwa-app-nav__secondary" href="/admin">
          <NavIcon name="admin" size={19} />
          <span>Admin</span>
        </Link>
      ) : null}
    </nav>
  );
}
