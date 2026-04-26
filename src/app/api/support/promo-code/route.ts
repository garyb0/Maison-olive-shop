import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { getDefaultShareablePromoCode } from "@/lib/promo";
import { applyRateLimit } from "@/lib/rate-limit";
import { supportPromoLeadSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "support:promo-code", windowMs: 60_000, max: 8 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const body = await request.json();
    const parsed = supportPromoLeadSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid promo lead payload", 400);

    const language = parsed.data.language === "en" ? "en" : "fr";
    const promoCode = await getDefaultShareablePromoCode();
    const checkoutUrl = env.siteUrl + "/checkout?promoCode=" + encodeURIComponent(promoCode.code);
    const subject = language === "en" ? "Your Chez Olive promo code: " + promoCode.code : "Ton code promo Chez Olive : " + promoCode.code;
    const html = language === "en" ? "Hello,\n\nYour promo code is " + promoCode.code + ".\nUse it here: " + checkoutUrl : "Bonjour,\n\nTon code promo est " + promoCode.code + ".\nUtilise-le ici : " + checkoutUrl;

    await sendEmail({ to: parsed.data.email, subject, html });
    return jsonOk({ code: promoCode.code, checkoutUrl });
  } catch {
    return jsonError("Failed to deliver promo code", 500);
  }
}

