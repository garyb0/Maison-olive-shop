import { env } from "@/lib/env";

type EmailTemplateInput = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  currency: string;
  language: "fr" | "en";
};

const formatMoney = (amountCents: number, currency: string, language: "fr" | "en") =>
  new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

export function getBusinessInfo(language: "fr" | "en") {
  return {
    brand: "Maison Olive",
    supportEmail: env.businessSupportEmail,
    supportHours:
      language === "fr"
        ? "Lundi au vendredi, 9h à 17h (heure de Montréal)"
        : "Monday to Friday, 9am to 5pm (Montreal time)",
    shippingPolicy:
      language === "fr"
        ? "Expédition en 24 à 72h ouvrables. Livraison gratuite dès 75 $ CAD."
        : "Ships within 24 to 72 business hours. Free shipping over 75 CAD.",
  };
}

export function buildOrderConfirmationEmail(input: EmailTemplateInput) {
  const totalLabel = formatMoney(input.totalCents, input.currency, input.language);

  if (input.language === "fr") {
    return {
      subject: `Confirmation de commande ${input.orderNumber} — Maison Olive`,
      text: [
        `Bonjour ${input.customerName},`,
        "",
        `Merci pour ta commande ${input.orderNumber}.`,
        `Montant total: ${totalLabel}`,
        "",
        "Nous préparons ta commande et t’enverrons une confirmation d’expédition rapidement.",
        `Besoin d’aide? Écris-nous: ${getBusinessInfo("fr").supportEmail}`,
      ].join("\n"),
    };
  }

  return {
    subject: `Order confirmation ${input.orderNumber} — Maison Olive`,
    text: [
      `Hi ${input.customerName},`,
      "",
      `Thank you for your order ${input.orderNumber}.`,
      `Total amount: ${totalLabel}`,
      "",
      "We are preparing your order and will send shipping confirmation shortly.",
      `Need help? Contact us: ${getBusinessInfo("en").supportEmail}`,
    ].join("\n"),
  };
}

// Placeholder sender for now (console log). Can be replaced by Resend/Sendgrid later.
export async function sendOrderConfirmationEmail(input: EmailTemplateInput) {
  const message = buildOrderConfirmationEmail(input);

  // If no provider is configured yet, keep safe fallback logs.
  if (!env.resendApiKey) {
    console.log("[ORDER_EMAIL:DEV_FALLBACK]", {
      to: input.customerEmail,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [input.customerEmail],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const payload = await res.text();
      console.error("[ORDER_EMAIL:RESEND_ERROR]", {
        status: res.status,
        payload,
      });
    }
  } catch (error) {
    // Do not block checkout if email provider is temporarily down.
    console.error("[ORDER_EMAIL:NETWORK_ERROR]", error);
  }
}
