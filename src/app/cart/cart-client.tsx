"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

type ProductInfo = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  priceLabel: string;
};

type ProductIndex = Record<string, ProductInfo>;

type CartLine = {
  productId: string;
  name?: string;
  quantity: number;
};

type CartQuote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

type Props = {
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  productIndex: ProductIndex;
  shippingFlatCents: number;
  shippingFreeThresholdCents: number;
};

const CART_STORAGE_KEY = "chezolive_cart_v1";

const fmt = (cents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);

const readStoredCart = (): CartLine[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
};

export function CartClient({
  language,
  t,
  user,
  productIndex,
  shippingFlatCents,
  shippingFreeThresholdCents,
}: Props) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const saveCart = (updated: CartLine[]) => {
    setCart(updated);
    const nextValue = JSON.stringify(updated);
    localStorage.setItem(CART_STORAGE_KEY, nextValue);
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: nextValue }));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      saveCart(cart.filter((l) => l.productId !== productId));
    } else {
      saveCart(cart.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)));
    }
  };

  const remove = (productId: string) => {
    saveCart(cart.filter((l) => l.productId !== productId));
  };

  const rows = cart.map((line) => {
    const product = productIndex[line.productId];
    const currency = product?.currency ?? "CAD";
    const priceCents = product?.priceCents ?? 0;
    const subtotalCents = priceCents * line.quantity;
    return {
      ...line,
      name: product?.name ?? line.name ?? (language === "fr" ? "Produit indisponible" : "Unavailable product"),
      priceLabel: product?.priceLabel ?? "-",
      subtotalLabel: fmt(subtotalCents, currency, locale),
      subtotalCents,
      currency,
    };
  });

  const totalCents = rows.reduce((acc, r) => acc + r.subtotalCents, 0);
  const totalLabel = rows.length > 0
    ? fmt(totalCents, rows[0]?.currency ?? "CAD", locale)
    : fmt(0, "CAD", locale);
  const beforeTaxCents = quote
    ? Math.max(0, quote.subtotalCents - quote.discountCents) + quote.shippingCents
    : totalCents;
  const cartSubtitle = !cartLoaded
    ? language === "fr"
      ? "Chargement du panier..."
      : "Loading cart..."
    : language === "fr"
      ? `${rows.length} article${rows.length !== 1 ? "s" : ""} dans ton panier`
      : `${rows.length} item${rows.length !== 1 ? "s" : ""} in your cart`;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCart(readStoredCart());
      setCartLoaded(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!cart.length) {
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
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setQuote(null);
          return;
        }

        const data = (await response.json()) as { quote?: CartQuote };
        setQuote(data.quote ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setQuote(null);
        }
      }
    };

    void loadQuote();

    return () => controller.abort();
  }, [cart]);

  const visibleQuote = rows.length > 0 ? quote : null;
  const pricedSubtotalCents = visibleQuote?.subtotalCents ?? totalCents;
  const remainingForFreeShippingCents = Math.max(0, shippingFreeThresholdCents - pricedSubtotalCents);
  const qualifiesForFreeShipping = rows.length > 0 && visibleQuote?.shippingCents === 0;
  const freeShippingProgress = shippingFreeThresholdCents > 0
    ? Math.min(100, Math.round((pricedSubtotalCents / shippingFreeThresholdCents) * 100))
    : 100;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <section className="section cart-page-header cart-market-header">
        <div className="cart-page-title-row">
          <span className="cart-page-icon cart-page-icon--mascot" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/chez-olive/olive-head.png" alt="" />
          </span>
          <div>
            <p className="home-eyebrow">
              {language === "fr" ? "Panier Chez Olive" : "Chez Olive cart"}
            </p>
            <h1 className="cart-page-title">{t.cart}</h1>
            <p className="cart-page-subtitle">{cartSubtitle}</p>
          </div>
        </div>
        <div className="cart-market-promises" aria-label={language === "fr" ? "Promesses de commande" : "Order promises"}>
          <span>{language === "fr" ? "Livraison locale" : "Local delivery"}</span>
          <span>{language === "fr" ? "Paiement sécurisé" : "Secure payment"}</span>
          <span>{language === "fr" ? "Support attentionné" : "Thoughtful support"}</span>
        </div>
      </section>

      {!cartLoaded ? (
        <section className="section cart-empty-state cart-loading-state" aria-live="polite">
          <div className="cart-empty-portrait" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/chez-olive/olive-logo-square.png" alt="" />
          </div>
          <div className="cart-empty-copy">
            <p className="home-eyebrow">{language === "fr" ? "Un instant" : "One moment"}</p>
            <h2>{language === "fr" ? "On prépare ton panier." : "Preparing your cart."}</h2>
          </div>
        </section>
      ) : rows.length === 0 ? (
        <section className="section cart-empty-state">
          <div className="cart-empty-portrait" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/chez-olive/olive-logo-square.png" alt="" />
          </div>
          <div className="cart-empty-copy">
            <p className="home-eyebrow">{language === "fr" ? "À remplir doucement" : "Ready when you are"}</p>
            <h2>{language === "fr" ? "Ton panier est vide pour l’instant." : "Your cart is empty for now."}</h2>
            <p className="cart-empty-text">
              {language === "fr"
                ? "Découvre les sélections locales et ajoute les essentiels de ton compagnon."
                : "Browse the local selection and add your companion’s essentials."}
            </p>
          </div>
          <Link className="btn cart-empty-shop-btn" href="/boutique">
            {language === "fr" ? "Retour à la boutique" : "Back to shop"}
          </Link>
        </section>
      ) : (
        <>
          <section className="cart-route-strip" aria-label={language === "fr" ? "Progression de commande" : "Order progress"}>
            <span className="cart-route-step cart-route-step--active">
              {language === "fr" ? "1. Panier" : "1. Cart"}
            </span>
            <span className="cart-route-step">
              {language === "fr" ? "2. Livraison" : "2. Delivery"}
            </span>
            <span className="cart-route-step">
              {language === "fr" ? "3. Paiement" : "3. Payment"}
            </span>
          </section>

          <section className="section cart-free-delivery-card">
            <div className="cart-free-delivery-copy">
              <strong>
                {qualifiesForFreeShipping
                  ? language === "fr"
                    ? "Livraison gratuite débloquée"
                    : "Free delivery unlocked"
                  : language === "fr"
                    ? "Objectif livraison gratuite"
                    : "Free delivery goal"}
              </strong>
              <span>
                {qualifiesForFreeShipping
                  ? language === "fr"
                    ? "Ton panier a atteint le seuil. Le checkout confirmera l'adresse locale."
                    : "Your cart reached the threshold. Checkout will confirm the local address."
                  : language === "fr"
                    ? `Ajoute ${fmt(remainingForFreeShippingCents, "CAD", locale)} pour profiter de la livraison gratuite.`
                    : `Add ${fmt(remainingForFreeShippingCents, "CAD", locale)} to unlock free delivery.`}
              </span>
            </div>
            <div className="cart-free-delivery-progress" aria-hidden="true">
              <span style={{ width: `${freeShippingProgress}%` }} />
            </div>
          </section>

          <section className="section cart-content-section">
            <div className="cart-lines-panel">
              <div className="cart-section-head">
                <div>
                  <p className="home-eyebrow">{language === "fr" ? "Sélection" : "Selection"}</p>
                  <h2>{language === "fr" ? "Articles à commander" : "Items to order"}</h2>
                </div>
                <Link className="cart-continue-link cart-continue-link--top" href="/boutique">
                  {language === "fr" ? "Continuer mes achats" : "Continue shopping"}
                </Link>
              </div>

              <div className="cart-table-wrap">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>{language === "fr" ? "Produit" : "Product"}</th>
                      <th className="cart-th-price">{language === "fr" ? "Prix unit." : "Unit price"}</th>
                      <th className="cart-th-qty">{language === "fr" ? "Quantité" : "Qty"}</th>
                      <th className="cart-th-subtotal">{language === "fr" ? "Sous-total" : "Subtotal"}</th>
                      <th className="cart-th-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.productId} className="cart-row">
                        <td className="cart-td-name">
                          <span className="cart-product-mark" aria-hidden="true">🐾</span>
                          <span className="cart-product-name">{row.name}</span>
                        </td>
                        <td className="cart-td-price" data-label={language === "fr" ? "Prix unit." : "Unit price"}>
                          <span className="cart-price-badge">{row.priceLabel}</span>
                        </td>
                        <td className="cart-td-qty" data-label={language === "fr" ? "Quantité" : "Quantity"}>
                          <div className="cart-qty-control">
                            <button
                              className="cart-qty-btn"
                              type="button"
                              onClick={() => updateQty(row.productId, row.quantity - 1)}
                              aria-label={language === "fr" ? "Diminuer" : "Decrease"}
                            >
                              -
                            </button>
                            <input
                              className="cart-qty-input"
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => updateQty(row.productId, Math.max(1, Number(e.target.value) || 1))}
                            />
                            <button
                              className="cart-qty-btn"
                              type="button"
                              onClick={() => updateQty(row.productId, row.quantity + 1)}
                              aria-label={language === "fr" ? "Augmenter" : "Increase"}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="cart-td-subtotal" data-label={language === "fr" ? "Sous-total" : "Subtotal"}>
                          <strong className="cart-subtotal-value">{row.subtotalLabel}</strong>
                        </td>
                        <td className="cart-td-action" data-label={language === "fr" ? "Action" : "Action"}>
                          <button
                            className="cart-remove-btn"
                            type="button"
                            onClick={() => remove(row.productId)}
                            aria-label={language === "fr" ? "Retirer" : "Remove"}
                            title={language === "fr" ? "Retirer" : "Remove"}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Récapitulatif total */}
            <div className="cart-summary">
              <div className="cart-summary-inner">
                <p className="home-eyebrow">{language === "fr" ? "Résumé" : "Summary"}</p>
                <h2 className="cart-summary-title">{language === "fr" ? "Total estimé" : "Estimated total"}</h2>
                <div className="cart-summary-row">
                  <span className="cart-summary-label">
                    {language === "fr" ? "Sous-total" : "Subtotal"}
                  </span>
                  <span className="cart-summary-value">
                    {visibleQuote ? fmt(visibleQuote.subtotalCents, "CAD", locale) : totalLabel}
                  </span>
                </div>
                {visibleQuote && visibleQuote.discountCents > 0 ? (
                  <div className="cart-summary-row">
                    <span className="cart-summary-label">
                      {language === "fr" ? "Rabais promo" : "Promo discount"}
                    </span>
                    <span className="cart-summary-value">
                      -{fmt(visibleQuote.discountCents, "CAD", locale)}
                    </span>
                  </div>
                ) : null}
                <div className="cart-summary-row">
                  <span className="cart-summary-label">
                    {language === "fr" ? "Livraison estimée" : "Estimated shipping"}
                  </span>
                  <span className="cart-summary-value">
                    {visibleQuote ? fmt(visibleQuote.shippingCents, "CAD", locale) : language === "fr" ? "Calcul..." : "Calculating..."}
                  </span>
                </div>
                {rows.length > 0 ? (
                  <div
                    className={`cart-summary-goal${qualifiesForFreeShipping ? " cart-summary-goal--active" : ""}`}
                  >
                    <p className="cart-summary-goal-title">
                      {qualifiesForFreeShipping
                        ? language === "fr"
                          ? "Livraison gratuite activée"
                          : "Free shipping unlocked"
                        : language === "fr"
                          ? "Objectif livraison gratuite"
                          : "Free shipping goal"}
                    </p>
                    <p className="cart-summary-goal-text">
                      {qualifiesForFreeShipping
                        ? language === "fr"
                          ? "Ce panier a déjà atteint le seuil de livraison gratuite."
                          : "This cart already reached the free shipping threshold."
                        : remainingForFreeShippingCents > 0
                          ? language === "fr"
                            ? `Plus que ${fmt(remainingForFreeShippingCents, "CAD", locale)} pour profiter de la livraison gratuite.`
                            : `Add ${fmt(remainingForFreeShippingCents, "CAD", locale)} more to unlock free shipping.`
                          : language === "fr"
                            ? `La livraison locale commence à ${fmt(shippingFlatCents, "CAD", locale)}.`
                            : `Local delivery starts at ${fmt(shippingFlatCents, "CAD", locale)}.`}
                    </p>
                  </div>
                ) : null}
                <div className="cart-summary-row">
                  <span className="cart-summary-label">
                    {language === "fr" ? "Total avant taxes" : "Total before taxes"}
                  </span>
                  <span className="cart-summary-value">
                    {visibleQuote ? fmt(beforeTaxCents, "CAD", locale) : totalLabel}
                  </span>
                </div>
                <div className="cart-summary-row">
                  <span className="cart-summary-label">
                    {language === "fr" ? "Taxes estimées" : "Estimated taxes"}
                  </span>
                  <span className="cart-summary-value">
                    {visibleQuote ? fmt(visibleQuote.taxCents, "CAD", locale) : language === "fr" ? "Calcul..." : "Calculating..."}
                  </span>
                </div>
                <div className="cart-summary-row cart-summary-row--total">
                  <span className="cart-summary-label">
                    {language === "fr" ? "Total estimé" : "Estimated total"}
                  </span>
                  <span className="cart-summary-total">
                    {visibleQuote ? fmt(visibleQuote.totalCents, "CAD", locale) : totalLabel}
                  </span>
                </div>
                <p className="small" style={{ marginTop: 10 }}>
                  {language === "fr"
                    ? "Estimation avant confirmation de livraison au checkout."
                    : "Estimate shown before delivery confirmation at checkout."}
                </p>
                <div className="cart-summary-trust">
                  <span>{language === "fr" ? "Livraison locale à Rimouski" : "Local delivery in Rimouski"}</span>
                  <span>{language === "fr" ? "Visa, Mastercard ou paiement local" : "Visa, Mastercard, or local payment"}</span>
                  <span>{language === "fr" ? "Support attentionné" : "Thoughtful support"}</span>
                </div>
                <Link className="btn cart-checkout-btn" href="/checkout">
                  {language === "fr" ? "Passer à la caisse" : "Proceed to checkout"}
                </Link>
                <Link className="cart-continue-link" href="/">
                  {language === "fr" ? "Retour à l’accueil" : "Back to home"}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
}

