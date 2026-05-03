import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CurrentUser, CheckoutConfirmation } from "@/lib/types";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  user: CurrentUser | null;
  confirmation: CheckoutConfirmation | null;
  fallbackOrderNumber?: string;
  fallbackRegisterEmail?: string;
  fallbackPaymentMode?: "manual" | "stripe";
};

export function CheckoutSuccessView({
  language,
  user,
  confirmation,
  fallbackOrderNumber,
  fallbackRegisterEmail,
  fallbackPaymentMode = "stripe",
}: Props) {
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const orderNumber = confirmation?.orderNumber ?? "";
  const registerEmail = confirmation?.registerEmail ?? "";
  const paymentMode = confirmation?.paymentMode ?? fallbackPaymentMode;
  const fallbackOrderReference = fallbackOrderNumber?.trim() ?? "";
  const fallbackEmailReference = fallbackRegisterEmail?.trim() ?? "";
  const createAccountHref = registerEmail
    ? `/?registerEmail=${encodeURIComponent(registerEmail)}`
    : "/";
  const confirmationItemCount = confirmation
    ? confirmation.items.reduce((sum, item) => sum + item.quantity, 0)
    : 0;
  const confirmationItemCountLabel = language === "fr"
    ? `${confirmationItemCount} article${confirmationItemCount !== 1 ? "s" : ""}`
    : `${confirmationItemCount} item${confirmationItemCount !== 1 ? "s" : ""}`;

  if (!confirmation) {
    return (
      <section className="section checkout-success-shell">
        <article className="support-lite-card checkout-success-card checkout-success-card--unverified">
          <div className="checkout-success-hero">
            <span className="checkout-success-hero-icon" aria-hidden="true">{"\u{26A0}"}</span>
            <div className="checkout-success-hero-copy">
              <p className="support-lite-card__eyebrow">
                {language === "fr" ? "Confirmation à vérifier" : "Confirmation needs review"}
              </p>
              <h1 className="support-lite-card__title checkout-success-title">
                {language === "fr"
                  ? "On n’a pas pu confirmer cette commande."
                  : "We could not confirm this order."}
              </h1>
              <p className="small support-lite-card__text">
                {language === "fr"
                  ? "Les informations dans l’URL ne correspondent à aucune commande enregistrée. Si tu viens de payer par carte, la synchronisation peut prendre quelques instants; sinon retourne au checkout ou contacte le support."
                  : "The URL details do not match a saved order. If you just paid by card, syncing can take a few moments; otherwise return to checkout or contact support."}
              </p>
            </div>
          </div>

          {fallbackOrderReference || fallbackEmailReference ? (
            <div className="checkout-success-meta">
              {fallbackOrderReference ? (
                <div className="checkout-success-meta-item">
                  <span>{language === "fr" ? "Référence demandée" : "Requested reference"}</span>
                  <strong>{fallbackOrderReference}</strong>
                </div>
              ) : null}
              {fallbackEmailReference ? (
                <div className="checkout-success-meta-item">
                  <span>{language === "fr" ? "Courriel fourni" : "Provided email"}</span>
                  <strong>{fallbackEmailReference}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="checkout-success-next-step">
            <strong className="checkout-success-next-step-title">
              {language === "fr" ? "À faire maintenant" : "What to do now"}
            </strong>
            <p className="small checkout-success-note">
              {language === "fr"
                ? "Ne considère pas cette page comme une preuve de commande. Vérifie ton compte, reprends le checkout, ou écris-nous si tu as déjà reçu une confirmation de paiement."
                : "Do not treat this page as proof of order. Check your account, restart checkout, or contact us if you already received a payment confirmation."}
            </p>
          </div>

          <div className="checkout-success-actions">
            <Link className="btn" href="/checkout">
              {language === "fr" ? "Retour au checkout" : "Back to checkout"}
            </Link>
            {user ? (
              <Link className="btn btn-secondary" href="/account">
                {language === "fr" ? "Voir mon compte" : "View my account"}
              </Link>
            ) : null}
            <Link className="btn btn-secondary" href="/faq">
              {language === "fr" ? "Contacter le support" : "Contact support"}
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const amountRows = confirmation
    ? [
        {
          label: language === "fr" ? "Sous-total" : "Subtotal",
          value: formatCurrency(confirmation.subtotalCents, confirmation.currency, locale),
        },
        ...(confirmation.discountCents > 0
          ? [{
              label: language === "fr" ? "Rabais promo" : "Promo discount",
              value: `-${formatCurrency(confirmation.discountCents, confirmation.currency, locale)}`,
            }]
          : []),
        {
          label: language === "fr" ? "Livraison" : "Shipping",
          value: formatCurrency(confirmation.shippingCents, confirmation.currency, locale),
        },
        {
          label: language === "fr" ? "Total avant taxes" : "Total before taxes",
          value: formatCurrency(
            Math.max(0, confirmation.subtotalCents - confirmation.discountCents) + confirmation.shippingCents,
            confirmation.currency,
            locale,
          ),
          dividerBefore: true,
        },
        {
          label: language === "fr" ? "TPS (5%)" : "GST (5%)",
          value: formatCurrency(confirmation.gstCents, confirmation.currency, locale),
        },
        {
          label: language === "fr" ? "TVQ (9,975%)" : "QST (9.975%)",
          value: formatCurrency(confirmation.qstCents, confirmation.currency, locale),
        },
        {
          label: language === "fr" ? "Taxes totales" : "Total taxes",
          value: formatCurrency(confirmation.taxCents, confirmation.currency, locale),
        },
        {
          label: language === "fr" ? "Total" : "Total",
          value: formatCurrency(confirmation.totalCents, confirmation.currency, locale),
          dividerBefore: true,
          strong: true,
        },
      ]
    : [];

  return (
    <section className="section checkout-success-shell">
      <article className="support-lite-card checkout-success-card">
        <div className="checkout-success-hero">
          <span className="checkout-success-hero-icon">{"\u{2728}"}</span>
          <div className="checkout-success-hero-copy">
            <p className="support-lite-card__eyebrow">
              {paymentMode === "manual"
                ? language === "fr"
                  ? "Commande reçue"
                  : "Order received"
                : language === "fr"
                  ? "Commande confirmée"
                  : "Order confirmed"}
            </p>
            <h1 className="support-lite-card__title checkout-success-title">
              {paymentMode === "manual"
                ? language === "fr"
                  ? `Merci${orderNumber ? `, ta commande ${orderNumber} est bien enregistrée.` : ", ta commande est bien enregistrée."}`
                  : `Thank you${orderNumber ? `, your order ${orderNumber} has been recorded.` : ", your order has been recorded."}`
                : language === "fr"
                  ? `Merci${orderNumber ? `, ta commande ${orderNumber} est bien reçue.` : ", ta commande est bien reçue."}`
                  : `Thank you${orderNumber ? `, your order ${orderNumber} has been received.` : ", your order has been received."}`}
            </h1>
            <p className="small support-lite-card__text">
              {paymentMode === "manual"
                ? language === "fr"
                  ? "Le paiement se fera à la livraison. Ton courriel de confirmation avec le résumé et la somme due sera envoyé sous peu."
                  : "Payment will be collected on delivery. Your confirmation email with the order summary and amount due will arrive shortly."
                : language === "fr"
                  ? "Le paiement Stripe est confirmé et ton courriel de confirmation avec les détails de facture sera envoyé sous peu."
                  : "Your Stripe payment is confirmed and your confirmation email with invoice details will arrive shortly."}
            </p>
          </div>
        </div>

        <div className="checkout-success-meta">
          {orderNumber ? (
            <div className="checkout-success-meta-item">
              <span>{language === "fr" ? "Commande" : "Order"}</span>
              <strong>{orderNumber}</strong>
            </div>
          ) : null}
          {registerEmail ? (
            <div className="checkout-success-meta-item">
              <span>{language === "fr" ? "Courriel" : "Email"}</span>
              <strong>{registerEmail}</strong>
            </div>
          ) : null}
          <div className="checkout-success-meta-item">
            <span>{language === "fr" ? "Paiement" : "Payment"}</span>
            <strong>
              {paymentMode === "manual"
                ? language === "fr"
                  ? "Paiement à la livraison"
                  : "Pay on delivery"
                : "Stripe"}
            </strong>
          </div>
        </div>

        <div className="checkout-success-next-step">
          <strong className="checkout-success-next-step-title">
            {language === "fr" ? "Prochaine bonne étape" : "Good next step"}
          </strong>
          <p className="small checkout-success-note">
            {user
              ? language === "fr"
                ? paymentMode === "manual"
                  ? "Tu peux maintenant retrouver la commande dans ton compte et vérifier facilement la somme due avant la livraison."
                  : "Tu peux maintenant retrouver tes commandes dans ton compte et continuer tes prochains achats encore plus vite."
                : paymentMode === "manual"
                  ? "You can now review the order in your account and verify the amount due before delivery."
                  : "You can now find your orders in your account and make future purchases even faster."
              : language === "fr"
                ? "Crée un compte avec ce même courriel pour retrouver plus facilement tes prochaines commandes, ton carnet d’adresses et ton historique."
                : "Create an account with this same email to access future orders, saved addresses, and your order history more easily."}
          </p>
        </div>

        {confirmation ? (
          <div className="checkout-success-invoice">
            <div className="checkout-success-invoice-head">
              <div>
                <span className="checkout-success-invoice-label">
                  {language === "fr" ? "Facture" : "Invoice"}
                </span>
                <h2>{language === "fr" ? "Résumé de la commande" : "Order summary"}</h2>
              </div>
              <span className="checkout-summary-count">{confirmationItemCountLabel}</span>
            </div>

            <div className="checkout-success-invoice-grid">
              <div className="checkout-success-invoice-panel">
                <span className="checkout-success-invoice-label">
                  {language === "fr" ? "Date de commande" : "Order date"}
                </span>
                <strong>{formatDate(confirmation.orderCreatedAt, locale)}</strong>
              </div>
              <div className="checkout-success-invoice-panel">
                <span className="checkout-success-invoice-label">
                  {paymentMode === "manual"
                    ? language === "fr"
                      ? "Somme due"
                      : "Amount due"
                    : language === "fr"
                      ? "Reçu"
                      : "Receipt"}
                </span>
                <strong>
                  {paymentMode === "manual"
                    ? formatCurrency(confirmation.totalCents, confirmation.currency, locale)
                    : language === "fr"
                      ? "Envoyé au même courriel"
                      : "Sent to the same email"}
                </strong>
              </div>
            </div>

            <div className="checkout-success-line-items">
              {confirmation.items.map((item) => (
                <div key={item.id} className="checkout-success-line-item">
                  <div>
                    <strong>{language === "fr" ? item.nameFr : item.nameEn}</strong>
                    <p className="small checkout-success-line-meta">
                      {language === "fr" ? "Quantité" : "Quantity"}: {item.quantity}
                    </p>
                  </div>
                  <strong>{formatCurrency(item.lineTotalCents, confirmation.currency, locale)}</strong>
                </div>
              ))}
            </div>

            <div className="checkout-success-amounts">
              <div className="checkout-success-amounts-head">
                <span>{language === "fr" ? "Montants" : "Amounts"}</span>
              </div>
              {amountRows.map((row) => (
                <div
                  key={row.label}
                  className={`checkout-success-amount-row${row.dividerBefore ? " checkout-success-amount-row--divider" : ""}${row.strong ? " checkout-success-amount-row--strong" : ""}`}
                >
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="checkout-success-actions">
          {user ? (
            <Link className="btn" href="/account">
              {language === "fr" ? "Voir mon compte" : "View my account"}
            </Link>
          ) : (
            <Link className="btn" href={createAccountHref}>
              {language === "fr" ? "Créer un compte" : "Create an account"}
            </Link>
          )}
          <Link className="btn btn-secondary" href="/">
            {language === "fr" ? "Retour à la boutique" : "Back to shop"}
          </Link>
          <Link className="btn btn-secondary" href="/faq">
            {language === "fr" ? "Centre d’aide" : "Help center"}
          </Link>
        </div>
      </article>
    </section>
  );
}
