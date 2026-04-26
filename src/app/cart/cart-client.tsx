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
  name: string;
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

export function CartClient({
  language,
  t,
  user,
  productIndex,
  shippingFlatCents,
  shippingFreeThresholdCents,
}: Props) {
  const [cart, setCart] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CartLine[];
    } catch {
      return [];
    }
  });
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const saveCart = (updated: CartLine[]) => {
    setCart(updated);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <section className="section cart-page-header">
        <div className="cart-page-title-row">
          <span className="cart-page-icon" aria-hidden="true">{"\u{1F6D2}"}</span>
          <div>
            <h1 className="cart-page-title">{t.cart}</h1>
            <p className="cart-page-subtitle">
              {language === "fr"
                ? `${rows.length} article${rows.length !== 1 ? "s" : ""} dans ton panier`
                : `${rows.length} item${rows.length !== 1 ? "s" : ""} in your cart`}
            </p>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="section cart-empty-state">
          <span className="cart-empty-icon" aria-hidden="true">{"\u{1F43E}"}</span>
          <p className="cart-empty-text">
            {language === "fr" ? "Ton panier est vide pour l'instant." : "Your cart is empty for now."}
          </p>
          <Link className="btn" href="/">
            {language === "fr" ? "< Retour à la boutique" : "< Back to shop"}
          </Link>
        </section>
      ) : (
        <>
          <section className="section">
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
                        <span className="cart-product-name">{row.name}</span>
                      </td>
                      <td className="cart-td-price">
                        <span className="cart-price-badge">{row.priceLabel}</span>
                      </td>
                      <td className="cart-td-qty">
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
                      <td className="cart-td-subtotal">
                        <strong className="cart-subtotal-value">{row.subtotalLabel}</strong>
                      </td>
                      <td className="cart-td-action">
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

            {/* Récapitulatif total */}
            <div className="cart-summary">
              <div className="cart-summary-inner">
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
                <Link className="btn cart-checkout-btn" href="/checkout">
                  {language === "fr" ? "Passer à la caisse >" : "Proceed to checkout >"}
                </Link>
                <Link className="cart-continue-link" href="/">
                  {language === "fr" ? "< Continuer mes achats" : "< Continue shopping"}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
}

