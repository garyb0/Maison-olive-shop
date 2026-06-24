import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCurrentLanguage } from "@/lib/language";
import { AccountSupportClient } from "./account-support-client";

export default async function AccountSupportPage() {
  await getCurrentUser();
  const language = await getCurrentLanguage();

  return <AccountSupportClient language={language} supportEmail={env.businessSupportEmail} />;
}
