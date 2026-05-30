"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppMobileNav } from "@/app/app/app-mobile-nav";
import { PwaAppHeader } from "@/app/app/pwa-app-header";
import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

const HIDDEN_PREFIXES = ["/admin", "/driver", "/dog"];

type Props = {
  language: Language;
  userRole: UserRole | null;
};

export function NativeAppChromeClient({ language, userRole }: Props) {
  const pathname = usePathname() ?? "";
  const [isNativeChromeEnabled, setIsNativeChromeEnabled] = useState(false);
  const hideChrome = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  useEffect(() => {
    const id = window.setTimeout(() => {
      setIsNativeChromeEnabled(document.documentElement.classList.contains("is-capacitor-native"));
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const shouldShowChrome = isNativeChromeEnabled && !hideChrome;
    document.body.classList.toggle("has-native-client-chrome", shouldShowChrome);
    document.documentElement.classList.toggle("has-native-client-chrome", shouldShowChrome);

    return () => {
      document.body.classList.remove("has-native-client-chrome");
      document.documentElement.classList.remove("has-native-client-chrome");
    };
  }, [hideChrome, isNativeChromeEnabled]);

  if (!isNativeChromeEnabled || hideChrome) return null;

  return (
    <div className="native-app-global-shell" aria-hidden="false">
      <div className="native-app-global-header">
        <PwaAppHeader language={language} userRole={userRole} />
      </div>
      <AppMobileNav language={language} userRole={userRole} className="native-app-tabbar" showSecondary={false} />
    </div>
  );
}
