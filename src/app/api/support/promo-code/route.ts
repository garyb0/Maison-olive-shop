import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { CHAT_PROMO_CODE } from "@/lib/promo";
import { applyRateLimit } from "@/lib/rate-limit";
import { supportPromoLeadSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = applyRateLimit(request, { namespace: "support:promo-code", windowMs: 60_000, max: 8 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const body = await request.json();
    const parsed = supportPromoLeadSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid promo lead payload", 400);

    const language = parsed.data.language === "en" ? "en" : "fr";
    const checkoutUrl = env.siteUrl + "/checkout?promoCode=" + encodeURIComponent(CHAT_PROMO_CODE);
    const subject = language === "en" ? "Your Maison Olive promo code: " + CHAT_PROMO_CODE : "Ton code promo Maison Olive : " + CHAT_PROMO_CODE;
    const html = language === "en" ? "Hello,\n\nYour promo code is " + CHAT_PROMO_CODE + ".\nUse it here: " + checkoutUrl : "Bonjour,\n\nTon code promo est " + CHAT_PROMO_CODE + ".\nUtilise-le ici : " + checkoutUrl;

    await sendEmail({ to: parsed.data.email, subject, html });
    return jsonOk({ code: CHAT_PROMO_CODE, checkoutUrl });
  } catch {
    return jsonError("Failed to deliver promo code", 500);
  }
}
