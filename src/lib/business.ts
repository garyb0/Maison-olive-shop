import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";
import type { DeliveryStatus, PaymentMethod } from "@/lib/types";

type EmailTemplateInput = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  orderCreatedAt?: Date | string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  language: "fr" | "en";
  paymentMethod?: PaymentMethod;
  deliveryStatus?: DeliveryStatus;
  shippingLine1?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  shippingPostal?: string | null;
  shippingCountry?: string | null;
  deliveryPhone?: string | null;
  deliveryInstructions?: string | null;
  deliveryWindowStartAt?: Date | string | null;
  deliveryWindowEndAt?: Date | string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
};

const formatMoney = (amountCents: number, currency: string, language: "fr" | "en") =>
  new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

const formatDateTime = (date: Date | string | null | undefined, language: "fr" | "en") => {
  if (!date) return null;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(parsed);
};

const formatDeliveryWindow = (
  startAt: Date | string | null | undefined,
  endAt: Date | string | null | undefined,
  language: "fr" | "en",
) => {
  if (!startAt || !endAt) return null;

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(startDate);

  const startLabel = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(startDate);

  const endLabel = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(endDate);

  return `${dateLabel} (${startLabel} - ${endLabel})`;
};

const formatAddress = (input: EmailTemplateInput) =>
  [
    input.shippingLine1,
    input.shippingCity,
    input.shippingRegion,
    input.shippingPostal,
    input.shippingCountry,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

const getPaymentMethodLabel = (paymentMethod: PaymentMethod | undefined, language: "fr" | "en") => {
  if (paymentMethod === "STRIPE") {
    return language === "fr" ? "Paiement en ligne (Stripe)" : "Online payment (Stripe)";
  }

  return language === "fr" ? "Paiement à la livraison" : "Pay on delivery";
};

const getDeliveryStatusLabel = (deliveryStatus: DeliveryStatus | undefined, language: "fr" | "en") => {
  if (!deliveryStatus) return null;

  const labels =
    language === "fr"
      ? {
          UNSCHEDULED: "Planification manuelle requise",
          SCHEDULED: "Livraison planifiée",
          OUT_FOR_DELIVERY: "En livraison",
          DELIVERED: "Livrée",
          FAILED: "Problème de livraison",
          RESCHEDULED: "Livraison replanifiée",
        }
      : {
          UNSCHEDULED: "Manual scheduling required",
          SCHEDULED: "Delivery scheduled",
          OUT_FOR_DELIVERY: "Out for delivery",
          DELIVERED: "Delivered",
          FAILED: "Delivery issue",
          RESCHEDULED: "Delivery rescheduled",
        };

  return labels[deliveryStatus];
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderLineItemsHtml = (
  items: EmailTemplateInput["items"],
  currency: string,
  language: "fr" | "en",
) =>
  items
    .map((item) => {
      const unitPriceLabel = formatMoney(item.unitPriceCents, currency, language);
      const lineTotalLabel = formatMoney(item.lineTotalCents, currency, language);

      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #E8DDD0;">
            <div style="font-weight: 600; color: #2C1E0F;">${escapeHtml(item.name)}</div>
            <div style="font-size: 12px; color: #8C7B65; margin-top: 4px;">
              ${language === "fr" ? "Quantité" : "Quantity"}: ${item.quantity} · ${language === "fr" ? "Prix unit." : "Unit price"}: ${unitPriceLabel}
            </div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #E8DDD0; text-align: right; font-weight: 600; color: #2C1E0F;">
            ${lineTotalLabel}
          </td>
        </tr>`;
    })
    .join("");

const renderSummaryRowHtml = (label: string, value: string, strong = false) => `
  <tr>
    <td style="padding: 8px 0; color: ${strong ? "#2C1E0F" : "#6B5B47"}; font-weight: ${strong ? 700 : 500};">${escapeHtml(label)}</td>
    <td style="padding: 8px 0; text-align: right; color: #2C1E0F; font-weight: ${strong ? 700 : 600};">${escapeHtml(value)}</td>
  </tr>`;

const renderEmailOverviewItem = (label: string, value: string, options?: { strong?: boolean }) => `
  <div style="min-width: 150px; flex: 1; padding: 4px 0;">
    <div style="font-size: 12px; color: #8C7B65; margin-bottom: 8px;">${escapeHtml(label)}</div>
    <div style="font-size: ${options?.strong ? "24px" : "15px"}; font-weight: ${options?.strong ? 800 : 700}; color: #2C1E0F; font-family: ${options?.strong ? "'Playfair Display', Georgia, serif" : "'Helvetica Neue', Arial, sans-serif"};">${escapeHtml(value)}</div>
  </div>
`;

export function getBusinessInfo(language: "fr" | "en") {
  return {
    brand: "Chez Olive",
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

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chez Olive</title>
  <style>
    body { margin: 0; padding: 0; background: #FAF8F4; font-family: 'Helvetica Neue', Arial, sans-serif; color: #2C1E0F; }
    .wrapper { max-width: 640px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E8DDD0; }
    .header { background: linear-gradient(135deg, #3D4A2A 0%, #5C6B40 100%); padding: 28px 32px; text-align: center; }
    .header-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.02em; }
    .header-sub { font-size: 13px; color: rgba(255,255,255,0.75); margin: 4px 0 0; }
    .body { padding: 32px; }
    .body p { font-size: 15px; line-height: 1.65; margin: 0 0 16px; }
    .body p:last-child { margin-bottom: 0; }
    .section-title { margin: 0 0 12px; font-size: 16px; color: #2C1E0F; }
    .card { margin: 24px 0; padding: 18px 20px; border: 1px solid #E8DDD0; border-radius: 14px; background: #FCFAF7; }
    .panel-grid { margin: 24px 0; font-size: 0; }
    .panel-grid .panel { display: inline-block; width: calc(50% - 8px); vertical-align: top; margin-right: 16px; margin-bottom: 16px; padding: 18px 20px; border: 1px solid #E8DDD0; border-radius: 14px; background: #FCFAF7; box-sizing: border-box; }
    .panel-grid .panel:nth-child(2n) { margin-right: 0; }
    .panel-label { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #8C7B65; font-weight: 700; }
    .panel-value { font-size: 15px; line-height: 1.65; color: #2C1E0F; font-weight: 700; }
    .panel-meta { margin-top: 10px; font-size: 14px; line-height: 1.7; color: #6B5B47; }
    .overview { margin: 20px 0 8px; padding: 0 0 12px; border-bottom: 1px solid #E8DDD0; }
    .overview-row { font-size: 0; }
    .line-items { margin: 24px 0; border: 1px solid #E8DDD0; border-radius: 14px; overflow: hidden; background: #FCFAF7; }
    .line-item { padding: 16px 18px; border-bottom: 1px solid #E8DDD0; }
    .line-item:last-child { border-bottom: none; }
    .line-item-price { float: right; font-weight: 700; color: #2C1E0F; }
    .line-item-title { font-weight: 700; color: #2C1E0F; margin: 0 0 6px; }
    .line-item-meta { font-size: 13px; color: #8C7B65; line-height: 1.5; margin: 0; }
    .amount-box { margin: 24px 0; padding: 14px 18px; border: 1px solid #E8DDD0; border-top: 3px solid #D6C2A8; border-radius: 14px; background: #FCFAF7; }
    .amount-divider { height: 1px; background: #E8DDD0; margin: 10px 0; }
    .note { font-size: 13px; color: #8C7B65; margin-top: 20px; padding-top: 20px; border-top: 1px solid #E8DDD0; }
    .footer { background: #F5F0E8; padding: 18px 32px; text-align: center; font-size: 12px; color: #8C7B65; }
    @media only screen and (max-width: 640px) {
      .body { padding: 22px; }
      .panel-grid .panel { display: block; width: 100%; margin-right: 0; }
      .line-item-price { float: none; display: block; margin-top: 8px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-title">Chez Olive</p>
      <p class="header-sub">Boutique animalière bilingue</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">© Chez Olive — Rimouski, QC</div>
  </div>
</body>
</html>`;

export function buildOrderConfirmationEmail(input: EmailTemplateInput) {
  const taxSummary = computeStoredOrderTaxBreakdown(
    input.subtotalCents,
    input.discountCents,
    input.shippingCents,
  );
  const business = getBusinessInfo(input.language);
  const beforeTaxCents = taxSummary.discountedSubtotal + input.shippingCents;
  const subtotalLabel = formatMoney(input.subtotalCents, input.currency, input.language);
  const discountLabel = formatMoney(input.discountCents, input.currency, input.language);
  const shippingLabel = formatMoney(input.shippingCents, input.currency, input.language);
  const beforeTaxLabel = formatMoney(beforeTaxCents, input.currency, input.language);
  const gstLabel = formatMoney(taxSummary.gstCents, input.currency, input.language);
  const qstLabel = formatMoney(taxSummary.qstCents, input.currency, input.language);
  const taxLabel = formatMoney(taxSummary.taxCents, input.currency, input.language);
  const totalLabel = formatMoney(input.totalCents, input.currency, input.language);
  const orderDateLabel = formatDateTime(input.orderCreatedAt, input.language);
  const deliveryLabel = formatDeliveryWindow(
    input.deliveryWindowStartAt,
    input.deliveryWindowEndAt,
    input.language,
  );
  const deliveryStatusLabel = getDeliveryStatusLabel(input.deliveryStatus, input.language);
  const paymentMethodLabel = getPaymentMethodLabel(input.paymentMethod, input.language);
  const amountDueLabel =
    input.paymentMethod === "MANUAL"
      ? input.language === "fr"
        ? "Montant à payer à la livraison"
        : "Amount due on delivery"
      : input.language === "fr"
        ? "Total"
        : "Total";
  const shippingAddressLabel = formatAddress(input);
  const deliveryFallback =
    input.language === "fr" ? "À confirmer avec notre équipe" : "To be confirmed with our team";
  const itemLines = input.items.map((item) => {
    const unitPrice = formatMoney(item.unitPriceCents, input.currency, input.language);
    const lineTotal = formatMoney(item.lineTotalCents, input.currency, input.language);
    return `- ${item.name} · ${item.quantity} × ${unitPrice} = ${lineTotal}`;
  });

  if (input.language === "fr") {
    return {
      subject: `Facture et confirmation de commande ${input.orderNumber} — Chez Olive`,
      text: [
        `Bonjour ${input.customerName},`,
        "",
        `Merci pour ta commande ${input.orderNumber}. Voici ton reçu/facture simplifié.`,
        ...(orderDateLabel ? [`Date: ${orderDateLabel}`] : []),
        `Commande: ${input.orderNumber}`,
        `Client: ${input.customerName}`,
        `Email: ${input.customerEmail}`,
        `Mode de paiement: ${paymentMethodLabel}`,
        ...(input.paymentMethod === "MANUAL" ? [`Montant à payer à la livraison: ${totalLabel}`] : []),
        ...(shippingAddressLabel ? [`Adresse de livraison: ${shippingAddressLabel}`] : []),
        `Créneau de livraison: ${deliveryLabel ?? deliveryFallback}`,
        ...(deliveryStatusLabel ? [`Statut de livraison: ${deliveryStatusLabel}`] : []),
        ...(input.deliveryPhone ? [`Téléphone livraison: ${input.deliveryPhone}`] : []),
        ...(input.deliveryInstructions ? [`Instructions: ${input.deliveryInstructions}`] : []),
        "",
        "Articles:",
        ...itemLines,
        "",
        `Sous-total: ${subtotalLabel}`,
        ...(input.discountCents > 0 ? [`Rabais promo: -${discountLabel}`] : []),
        `Livraison: ${shippingLabel}`,
        `Total avant taxes: ${beforeTaxLabel}`,
        `TPS (5%): ${gstLabel}`,
        `TVQ (9,975%): ${qstLabel}`,
        `Taxes totales: ${taxLabel}`,
        `Total: ${totalLabel}`,
        "",
        "Nous préparons ta commande et t’écrirons si une mise à jour de livraison est nécessaire.",
        `Besoin d’aide? Écris-nous: ${business.supportEmail}`,
      ].join("\n"),
      html: emailWrapper(`
        <p>Bonjour ${escapeHtml(input.customerName)},</p>
        <p>Merci pour ta commande <strong>${escapeHtml(input.orderNumber)}</strong>. Voici ton reçu/facture simplifié.</p>

        <div class="card">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #8C7B65; font-weight: 700;">Facture client</div>
          <div style="font-size: 24px; font-weight: 800; color: #2C1E0F; margin-top: 6px;">Commande #${escapeHtml(input.orderNumber)}</div>
          <div style="margin-top: 10px; font-size: 14px; color: #6B5B47; line-height: 1.7;">
            ${orderDateLabel ? `<div><strong>Date:</strong> ${escapeHtml(orderDateLabel)}</div>` : ""}
            <div><strong>Client:</strong> ${escapeHtml(input.customerName)}</div>
            <div><strong>Email:</strong> ${escapeHtml(input.customerEmail)}</div>
          </div>
        </div>

        <div class="overview">
          <div class="overview-row">
            ${renderEmailOverviewItem("Mode de paiement", paymentMethodLabel)}
            ${renderEmailOverviewItem("Livraison", deliveryStatusLabel ?? deliveryFallback)}
            ${renderEmailOverviewItem(amountDueLabel, totalLabel, { strong: true })}
          </div>
        </div>

        <div class="panel-grid">
          <div class="panel">
            <div class="panel-label">Client</div>
            <div class="panel-value">${escapeHtml(input.customerName)}</div>
            <div class="panel-meta">${escapeHtml(input.customerEmail)}</div>
          </div>
          <div class="panel">
            <div class="panel-label">Livraison</div>
            <div class="panel-value">${escapeHtml(shippingAddressLabel || "-")}</div>
            <div class="panel-meta">
              <div><strong>Créneau:</strong> ${escapeHtml(deliveryLabel ?? deliveryFallback)}</div>
              ${input.deliveryPhone ? `<div><strong>Téléphone:</strong> ${escapeHtml(input.deliveryPhone)}</div>` : ""}
              ${input.deliveryInstructions ? `<div><strong>Instructions:</strong> ${escapeHtml(input.deliveryInstructions)}</div>` : ""}
            </div>
          </div>
        </div>

        <div>
          <h3 class="section-title">Articles</h3>
          <div class="line-items">
            ${input.items
              .map((item) => `
                <div class="line-item">
                  <span class="line-item-price">${formatMoney(item.lineTotalCents, input.currency, input.language)}</span>
                  <div class="line-item-title">${escapeHtml(item.name)}</div>
                  <p class="line-item-meta">Quantité: ${item.quantity} · Prix unit.: ${formatMoney(item.unitPriceCents, input.currency, input.language)}</p>
                </div>
              `)
              .join("")}
          </div>
        </div>

        <div>
          <h3 class="section-title">Montants</h3>
          <div class="amount-box">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              <tbody>
                ${renderSummaryRowHtml("Sous-total", subtotalLabel)}
                ${input.discountCents > 0 ? renderSummaryRowHtml("Rabais promo", `-${discountLabel}`) : ""}
                ${renderSummaryRowHtml("Livraison", shippingLabel)}
                <tr><td colspan="2"><div class="amount-divider"></div></td></tr>
                ${renderSummaryRowHtml("Total avant taxes", beforeTaxLabel)}
                ${renderSummaryRowHtml("TPS (5%)", gstLabel)}
                ${renderSummaryRowHtml("TVQ (9,975%)", qstLabel)}
                ${renderSummaryRowHtml("Taxes totales", taxLabel)}
                <tr><td colspan="2"><div class="amount-divider"></div></td></tr>
                ${renderSummaryRowHtml("Total", totalLabel, true)}
              </tbody>
            </table>
          </div>
        </div>

        <p class="note">Besoin d’aide? Écris-nous à <a href="mailto:${escapeHtml(business.supportEmail)}" style="color:#3D4A2A;">${escapeHtml(business.supportEmail)}</a>.</p>
      `),
    };
  }

  return {
    subject: `Invoice and order confirmation ${input.orderNumber} — Chez Olive`,
    text: [
      `Hi ${input.customerName},`,
      "",
      `Thank you for your order ${input.orderNumber}. Here is your simplified invoice/receipt.`,
      ...(orderDateLabel ? [`Date: ${orderDateLabel}`] : []),
      `Order: ${input.orderNumber}`,
      `Customer: ${input.customerName}`,
      `Email: ${input.customerEmail}`,
      `Payment method: ${paymentMethodLabel}`,
      ...(input.paymentMethod === "MANUAL" ? [`Amount due on delivery: ${totalLabel}`] : []),
      ...(shippingAddressLabel ? [`Delivery address: ${shippingAddressLabel}`] : []),
      `Delivery window: ${deliveryLabel ?? deliveryFallback}`,
      ...(deliveryStatusLabel ? [`Delivery status: ${deliveryStatusLabel}`] : []),
      ...(input.deliveryPhone ? [`Delivery phone: ${input.deliveryPhone}`] : []),
      ...(input.deliveryInstructions ? [`Instructions: ${input.deliveryInstructions}`] : []),
      "",
      "Items:",
      ...itemLines,
      "",
      `Subtotal: ${subtotalLabel}`,
      ...(input.discountCents > 0 ? [`Promo discount: -${discountLabel}`] : []),
      `Shipping: ${shippingLabel}`,
      `Total before taxes: ${beforeTaxLabel}`,
      `GST (5%): ${gstLabel}`,
      `QST (9.975%): ${qstLabel}`,
      `Total taxes: ${taxLabel}`,
      `Total: ${totalLabel}`,
      "",
      "We are preparing your order and will contact you if a delivery update is needed.",
      `Need help? Contact us: ${business.supportEmail}`,
    ].join("\n"),
    html: emailWrapper(`
      <p>Hello ${escapeHtml(input.customerName)},</p>
      <p>Thank you for your order <strong>${escapeHtml(input.orderNumber)}</strong>. Here is your simplified invoice/receipt.</p>

      <div class="card">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #8C7B65; font-weight: 700;">Customer invoice</div>
        <div style="font-size: 24px; font-weight: 800; color: #2C1E0F; margin-top: 6px;">Order #${escapeHtml(input.orderNumber)}</div>
        <div style="margin-top: 10px; font-size: 14px; color: #6B5B47; line-height: 1.7;">
          ${orderDateLabel ? `<div><strong>Date:</strong> ${escapeHtml(orderDateLabel)}</div>` : ""}
          <div><strong>Customer:</strong> ${escapeHtml(input.customerName)}</div>
          <div><strong>Email:</strong> ${escapeHtml(input.customerEmail)}</div>
        </div>
      </div>

      <div class="overview">
        <div class="overview-row">
          ${renderEmailOverviewItem("Payment method", paymentMethodLabel)}
          ${renderEmailOverviewItem("Delivery", deliveryStatusLabel ?? deliveryFallback)}
          ${renderEmailOverviewItem(amountDueLabel, totalLabel, { strong: true })}
        </div>
      </div>

      <div class="panel-grid">
        <div class="panel">
          <div class="panel-label">Customer</div>
          <div class="panel-value">${escapeHtml(input.customerName)}</div>
          <div class="panel-meta">${escapeHtml(input.customerEmail)}</div>
        </div>
        <div class="panel">
          <div class="panel-label">Delivery</div>
          <div class="panel-value">${escapeHtml(shippingAddressLabel || "-")}</div>
          <div class="panel-meta">
            <div><strong>Window:</strong> ${escapeHtml(deliveryLabel ?? deliveryFallback)}</div>
            ${input.deliveryPhone ? `<div><strong>Phone:</strong> ${escapeHtml(input.deliveryPhone)}</div>` : ""}
            ${input.deliveryInstructions ? `<div><strong>Instructions:</strong> ${escapeHtml(input.deliveryInstructions)}</div>` : ""}
          </div>
        </div>
      </div>

      <div>
        <h3 class="section-title">Items</h3>
        <div class="line-items">
          ${input.items
            .map((item) => `
              <div class="line-item">
                <span class="line-item-price">${formatMoney(item.lineTotalCents, input.currency, input.language)}</span>
                <div class="line-item-title">${escapeHtml(item.name)}</div>
                <p class="line-item-meta">Quantity: ${item.quantity} · Unit price: ${formatMoney(item.unitPriceCents, input.currency, input.language)}</p>
              </div>
            `)
            .join("")}
        </div>
      </div>

      <div>
        <h3 class="section-title">Amounts</h3>
        <div class="amount-box">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            <tbody>
              ${renderSummaryRowHtml("Subtotal", subtotalLabel)}
              ${input.discountCents > 0 ? renderSummaryRowHtml("Promo discount", `-${discountLabel}`) : ""}
              ${renderSummaryRowHtml("Shipping", shippingLabel)}
              <tr><td colspan="2"><div class="amount-divider"></div></td></tr>
              ${renderSummaryRowHtml("Total before taxes", beforeTaxLabel)}
              ${renderSummaryRowHtml("GST (5%)", gstLabel)}
              ${renderSummaryRowHtml("QST (9.975%)", qstLabel)}
              ${renderSummaryRowHtml("Total taxes", taxLabel)}
              <tr><td colspan="2"><div class="amount-divider"></div></td></tr>
              ${renderSummaryRowHtml("Total", totalLabel, true)}
            </tbody>
          </table>
        </div>
      </div>

      <p class="note">Need help? Contact us at <a href="mailto:${escapeHtml(business.supportEmail)}" style="color:#3D4A2A;">${escapeHtml(business.supportEmail)}</a>.</p>
    `),
  };
}

export async function sendOrderConfirmationEmail(input: EmailTemplateInput) {
  const message = buildOrderConfirmationEmail(input);

  try {
    if (!env.resendApiKey && !env.smtpHost) {
      console.log("[ORDER_EMAIL:DEV_FALLBACK]", {
        to: input.customerEmail,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return;
    }

    await sendEmail({
      to: input.customerEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    console.error("[ORDER_EMAIL:SEND_FAILED]", error);
  }
}


