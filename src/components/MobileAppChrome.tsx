"use client";

import { AppMobileNav } from "@/app/app/app-mobile-nav";
import { PwaAppHeader } from "@/app/app/pwa-app-header";
import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types";

type Props = {
  language: Language;
  userRole: UserRole | null;
  className?: string;
};

export function MobileAppChrome({ language, userRole, className }: Props) {
  return (
    <div className={`mobile-app-clone-chrome${className ? ` ${className}` : ""}`}>
      <PwaAppHeader language={language} userRole={userRole} />
      <AppMobileNav language={language} userRole={userRole} showSecondary={false} />
    </div>
  );
}
