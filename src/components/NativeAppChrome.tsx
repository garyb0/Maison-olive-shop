import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { NativeAppChromeClient } from "./NativeAppChromeClient";
import { NativeAppGlobalRuntime } from "./NativeAppGlobalRuntime";

export async function NativeAppChrome() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);

  return (
    <>
      <NativeAppGlobalRuntime />
      <NativeAppChromeClient language={language} userRole={user?.role ?? null} />
    </>
  );
}
