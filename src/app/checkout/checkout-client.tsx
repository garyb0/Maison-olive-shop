"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";
import { isRimouskiPostalCode } from "@/lib/delivery-zone";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

type ProductIndex = Record<
  string,
  {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    priceLabel: string;
  }
>;

type Props = {
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  productIndex: ProductIndex;
};

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
};

type CheckoutQuote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

const CART_STORAGE_KEY = "maisonolive_cart_v1";

const formatCad = (cents: number, language: Language) =>
  new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);

export function CheckoutClient({ language, t, user, productIndex }: Props) {
  const searchParams = useSearchParams();
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingRegion, setShippingRegion] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");
  const [shippingCountry, setShippingCountry] = useState("CA");
  const [paymentMethod, setPaymentMethod] = useState<"MANUAL" | "STRIPE">("MANUAL");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);

  // Validation code postal en temps réel
  const postalTouched = shippingPostal.length >= 3;
  const postalValid = postalTouched ? isRimouskiPostalCode(shippingPostal) : true;

  useEffect(() => {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      setCart([]);
      return;
    }
    try {
      setCart(JSON.parse(raw) as CartLine[]);
    } catch {
      setCart([]);
    }
  }, []);

  const cartRows = useMemo(() => cart.map((line) => {
    const product = productIndex[line.productId];
    const lineSubtotalCents = (product?.priceCents ?? 0) * line.quantity;
    return {
      ...line,
      priceLabel: product?.priceLabel ?? "-",
      lineSubtotalCents,
      lineSubtotalLabel: new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
        style: "currency",
        currency: product?.currency ?? "CAD",
      }).format(lineSubtotalCents / 100),
    };
  }), [cart, language, productIndex]);

  const subtotalCents = cartRows.reduce((acc, row) => acc + row.lineSubtotalCents, 0);
  const subtotalLabel = formatCad(subtotalCents, language);
  const trimmedPromoCode = promoCode.trim().toUpperCase();
  const promoApplied = Boolean(quote && quote.discountCents > 0);

  useEffect(() => {
    const queryPromo = searchParams.get("promoCode")?.trim().toUpperCase();
    if (queryPromo) {
      setPromoCode((current) => current || queryPromo);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();

    const loadQuote = async () => {
      try {
        const response = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((row) => ({ productId: row.productId, quantity: row.quantity })),
            shippingPostal,
            shippingCountry,
            promoCode: trimmedPromoCode || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setQuote(null);
          return;
        }

        const data = (await response.json()) as { quote?: CheckoutQuote };
        setQuote(data.quote ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setQuote(null);
        }
      }
    };

    void loadQuote();

    return () => controller.abort();
  }, [cart, shippingCountry, shippingPostal, trimmedPromoCode]);

  const submitOrder = async () => {
    if (!user) {
      setError(language === "fr" ? "Connecte-toi avant de commander." : "Please login before ordering.");
      return;
    }
    if (!cartRows.length) {
      setError(language === "fr" ? "Panier vide." : "Cart is empty.");
      return;
    }

    // Validation zone de livraison
    if (shippingPostal && !isRimouskiPostalCode(shippingPostal)) {
      setError(
        language === "fr"
          ? "Désolé, nous livrons uniquement dans la région de Rimouski (ex: G5L, G5M, G5N, G0L…). Vérifie ton code postal."
          : "Sorry, we only deliver in the Rimouski area (e.g. G5L, G5M, G5N, G0L…). Please check your postal code.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartRows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
          paymentMethod,
          promoCode: trimmedPromoCode || undefined,
          shippingLine1,
          shippingCity,
          shippingRegion,
          shippingPostal,
          shippingCountry,
        }),
      });

      const json = (await res.json()) as {
        order?: { orderNumber: string };
        stripeCheckoutUrl?: string | null;
        error?: string;
      };

      if (!res.ok) {
        setError(json.error ?? (language === "fr" ? "Commande impossible." : "Could not place order."));
        return;
      }

      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);

      if (json.stripeCheckoutUrl) {
        window.location.href = json.stripeCheckoutUrl;
        return;
      }

      if (paymentMethod === "STRIPE") {
        setError(
          language === "fr"
            ? "Stripe est indisponible pour le moment. Essaie le paiement comptant ou vérifie la configuration."
            : "Stripe is currently unavailable. Try cash on delivery or verify configuration.",
        );
        return;
      }

      setMessage(
        language === "fr"
          ? `Commande ${json.order?.orderNumber ?? ""} créée — paiement comptant à la livraison.`
          : `Order ${json.order?.orderNumber ?? ""} created — cash on delivery.`,
      );

      const orderNumber = json.order?.orderNumber;
      if (orderNumber) {
        window.location.href = `/account?ordered=${encodeURIComponent(orderNumber)}`;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner />

      {/* ── Page header ── */}
      <section className="section checkout-page-header">
        <div className="checkout-page-title-row">
          <span className="checkout-page-icon">🧾</span>
          <div>
            <h1 className="checkout-page-title">{t.checkoutTitle}</h1>
            <p className="checkout-page-subtitle">{t.checkoutSubtitle}</p>
          </div>
        </div>
      </section>

      {cartRows.length === 0 ? (
        <section className="section cart-empty-state">
          <span className="cart-empty-icon">🛒</span>
          <p className="cart-empty-text">
            {language === "fr" ? "Ton panier est vide. Rien à commander." : "Your cart is empty. Nothing to order."}
          </p>
          <Link className="btn" href="/">
            {language === "fr" ? "← Retour à la boutique" : "← Back to shop"}
          </Link>
        </section>
      ) : (
        <div className="checkout-grid">
          {/* ── Colonne principale ── */}
          <div className="checkout-main">

            {/* Récapitulatif du panier */}
            <section className="section checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">🛒</span>
                <h2 className="checkout-section-title">
                  {language === "fr" ? "Récapitulatif" : "Order summary"}
                </h2>
              </div>

              <div className="cart-table-wrap">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>{language === "fr" ? "Produit" : "Product"}</th>
                      <th className="cart-th-price">{language === "fr" ? "Prix unit." : "Unit price"}</th>
                      <th className="cart-th-qty">{language === "fr" ? "Qté" : "Qty"}</th>
                      <th className="cart-th-subtotal">{language === "fr" ? "Sous-total" : "Subtotal"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartRows.map((row) => (
                      <tr key={row.productId} className="cart-row">
                        <td className="cart-td-name">
                          <span className="cart-product-name">{row.name}</span>
                        </td>
                        <td className="cart-td-price">
                          <span className="cart-price-badge">{row.priceLabel}</span>
                        </td>
                        <td className="cart-td-qty">
                          <span className="checkout-qty-pill">{row.quantity}</span>
                        </td>
                        <td className="cart-td-subtotal">
                          <strong className="cart-subtotal-value">{row.lineSubtotalLabel}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Adresse de livraison */}
            <section className="section checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">📦</span>
                <div>
                  <h2 className="checkout-section-title">
                    {language === "fr" ? "Adresse de livraison" : "Shipping address"}
                  </h2>
                  <p className="checkout-section-subtitle">
                    {language === "fr"
                      ? "Livraison locale — région de Rimouski seulement 📍"
                      : "Local delivery — Rimouski area only 📍"}
                  </p>
                </div>
              </div>

              <div className="checkout-address-grid">
                <div className="field checkout-field-full">
                  <label>{language === "fr" ? "Adresse" : "Street address"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🏠</span>
                    <input
                      className="input input--icon"
                      placeholder={language === "fr" ? "123 rue des Oliviers" : "123 Olive Street"}
                      value={shippingLine1}
                      onChange={(e) => setShippingLine1(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                <div className="field">
                  <label>{language === "fr" ? "Ville" : "City"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🏙️</span>
                    <input
                      className="input input--icon"
                      placeholder="Rimouski"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                <div className="field">
                  <label>{language === "fr" ? "Province" : "Province"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🗺️</span>
                    <input
                      className="input input--icon"
                      placeholder="QC"
                      value={shippingRegion}
                      onChange={(e) => setShippingRegion(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                <div className="field">
                  <label>
                    {language === "fr" ? "Code postal" : "Postal code"}
                    {postalTouched && (
                      <span className={`checkout-postal-badge${postalValid ? " checkout-postal-badge--ok" : " checkout-postal-badge--err"}`}>
                        {postalValid
                          ? (language === "fr" ? " ✓ Zone couverte" : " ✓ Zone covered")
                          : (language === "fr" ? " ✗ Hors zone" : " ✗ Out of zone")}
                      </span>
                    )}
                  </label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">📮</span>
                    <input
                      className={`input input--icon${postalTouched && !postalValid ? " input--error" : ""}`}
                      placeholder="G5L 1A1"
                      value={shippingPostal}
                      onChange={(e) => setShippingPostal(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                  {postalTouched && !postalValid && (
                    <p className="checkout-postal-hint">
                      {language === "fr"
                        ? "Codes acceptés : G5L, G5M, G5N, G5J, G5K, G5H, G0L, G5X, G0J et alentours."
                        : "Accepted codes: G5L, G5M, G5N, G5J, G5K, G5H, G0L, G5X, G0J and surroundings."}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label>{language === "fr" ? "Pays" : "Country"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🌍</span>
                    <input
                      className="input input--icon"
                      placeholder="CA"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Méthode de paiement */}
            <section className="section checkout-section-card">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">💳</span>
                <div>
                  <h2 className="checkout-section-title">
                    {language === "fr" ? "Méthode de paiement" : "Payment method"}
                  </h2>
                  <p className="checkout-section-subtitle">
                    {language === "fr" ? "Choisissez comment vous souhaitez payer." : "Choose how you'd like to pay."}
                  </p>
                </div>
              </div>

              <div className="checkout-payment-methods">
                <label className={`checkout-payment-option${paymentMethod === "MANUAL" ? " checkout-payment-option--active" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MANUAL"
                    checked={paymentMethod === "MANUAL"}
                    onChange={() => setPaymentMethod("MANUAL")}
                    className="checkout-payment-radio"
                  />
                  <span className="checkout-payment-option-icon">💵</span>
                  <div className="checkout-payment-option-text">
                    <span className="checkout-payment-option-label">{t.manualPayment}</span>
                    <span className="checkout-payment-option-desc">
                      {language === "fr"
                        ? "Paiement comptant au moment de la livraison. Livraison locale uniquement (région de Rimouski)."
                        : "Cash payment at the time of delivery. Local delivery only (Rimouski area)."}
                    </span>
                  </div>
                  {paymentMethod === "MANUAL" && <span className="checkout-payment-check">✓</span>}
                </label>

                <label className={`checkout-payment-option${paymentMethod === "STRIPE" ? " checkout-payment-option--active" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="STRIPE"
                    checked={paymentMethod === "STRIPE"}
                    onChange={() => setPaymentMethod("STRIPE")}
                    className="checkout-payment-radio"
                  />
                  <span className="checkout-payment-option-icon">⚡</span>
                  <div className="checkout-payment-option-text">
                    <span className="checkout-payment-option-label">{t.stripePayment}</span>
                    <span className="checkout-payment-option-desc">
                      {language === "fr"
                        ? "Redirigé vers la page de paiement sécurisée Stripe."
                        : "Redirected to Stripe's secure checkout page."}
                    </span>
                  </div>
                  {paymentMethod === "STRIPE" && <span className="checkout-payment-check">✓</span>}
                </label>
              </div>
            </section>

          </div>

          {/* ── Colonne résumé ── */}
          <div className="checkout-sidebar">
            <div className="checkout-summary-card">
              <div className="checkout-summary-title">
                {language === "fr" ? "Résumé de la commande" : "Order total"}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>{language === "fr" ? "Code promo" : "Promo code"}</label>
                <input
                  className="input"
                  placeholder={language === "fr" ? "Ex. OLIVE10" : "e.g. OLIVE10"}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
                {trimmedPromoCode && (
                  <p className={promoApplied ? "ok" : "small"}>
                    {promoApplied
                      ? (language === "fr" ? "✓ Le rabais de 10% est appliqué." : "✓ Your 10% discount is applied.")
                      : (language === "fr" ? "Le code sera vérifié automatiquement au calcul." : "The code will be checked automatically during pricing.")}
                  </p>
                )}
              </div>

              <div className="checkout-summary-lines">
                {cartRows.map((row) => (
                  <div key={row.productId} className="checkout-summary-line">
                    <span className="checkout-summary-line-name">
                      {row.name} <span className="checkout-summary-line-qty">×{row.quantity}</span>
                    </span>
                    <span className="checkout-summary-line-price">{row.lineSubtotalLabel}</span>
                  </div>
                ))}
              </div>

              <div className="checkout-summary-divider" />

              <div className="checkout-summary-row">
                <span>{language === "fr" ? "Sous-total" : "Subtotal"}</span>
                <span>{quote ? formatCad(quote.subtotalCents, language) : subtotalLabel}</span>
              </div>
              {quote && quote.discountCents > 0 && (
                <div className="checkout-summary-row">
                  <span>{language === "fr" ? "Rabais promo" : "Promo discount"}</span>
                  <span>-{formatCad(quote.discountCents, language)}</span>
                </div>
              )}
              <div className="checkout-summary-row checkout-summary-row--shipping">
                <span>{language === "fr" ? "Livraison" : "Shipping"}</span>
                <span className="checkout-summary-free">
                  {quote
                    ? formatCad(quote.shippingCents, language)
                    : language === "fr"
                      ? "Calcul…"
                      : "Calculating…"}
                </span>
              </div>
              <div className="checkout-summary-row">
                <span>{language === "fr" ? "Taxes" : "Taxes"}</span>
                <span>{quote ? formatCad(quote.taxCents, language) : language === "fr" ? "Calcul…" : "Calculating…"}</span>
              </div>

              <div className="checkout-summary-divider" />

              <div className="checkout-summary-total-row">
                <span>{language === "fr" ? "Total" : "Total"}</span>
                <span className="checkout-summary-total-amount">
                  {quote ? formatCad(quote.totalCents, language) : subtotalLabel}
                </span>
              </div>

              {/* Info zone livraison */}
              <div className="checkout-zone-note">
                📍 {language === "fr"
                  ? "Livraison locale — Rimouski et environs seulement."
                  : "Local delivery — Rimouski area only."}
              </div>

              {message ? (
                <div className="auth-alert auth-alert--ok">
                  <span>✅</span> {message}
                </div>
              ) : null}
              {error ? (
                <div className="auth-alert auth-alert--err">
                  <span>⚠️</span> {error}
                </div>
              ) : null}

              <button
                className="btn btn-full checkout-place-order-btn"
                disabled={loading}
                onClick={() => void submitOrder()}
                type="button"
                suppressHydrationWarning
              >
                {loading ? (
                  <span className="checkout-spinner">⏳</span>
                ) : (
                  <>
                    {t.placeOrder} — {quote ? formatCad(quote.totalCents, language) : subtotalLabel}
                  </>
                )}
              </button>

              <Link className="checkout-back-link" href="/cart">
                {language === "fr" ? "← Retour au panier" : "← Back to cart"}
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
