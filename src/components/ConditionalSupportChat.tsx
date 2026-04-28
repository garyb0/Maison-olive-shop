"use client";

import { usePathname } from "next/navigation";
import { SupportChatWidget } from "@/components/SupportChatWidget";

type Props = {
  language: "fr" | "en";
  user?: { firstName?: string; email?: string; role?: string } | null;
};

export function ConditionalSupportChat({ language, user }: Props) {
  const pathname = usePathname();

  if (pathname.startsWith("/dog/") || pathname.startsWith("/admin")) {
    return null;
  }

  return <SupportChatWidget language={language} user={user} />;
}
