import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { SupportChatWidget } from "@/components/SupportChatWidget";

export async function GlobalSupportChat() {
  const [language, user] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
  ]);

  return <SupportChatWidget language={language} user={user} />;
}