import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { ConditionalSupportChat } from "@/components/ConditionalSupportChat";

export async function GlobalSupportChat() {
  const [language, user] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
  ]);

  return <ConditionalSupportChat language={language} user={user} />;
}
