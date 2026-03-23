"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";

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

const CART_STORAGE_KEY = "maisonolive_cart_v1";

export function CheckoutClient({ language, t, user, productIndex }: Props) {
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingRegion, setShippingRegion] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");
  const [shippingCountry, setShippingCountry] = useState("CA");
  const [paymentMethod, setPaymentMethod] = useState<"MANUAL" | "STRIPE">("MANUAL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

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

  const cartRows = cart.map((line) => {
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
  });

  const subtotalCents = cartRows.reduce((acc, row) => acc + row.lineSubtotalCents, 0);
  const subtotalLabel = new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(subtotalCents / 100);

  const submitOrder = async () => {
    if (!user) {
      setError(language === "fr" ? "Connecte-toi avant de commander." : "Please login before ordering.");
      return;
    }
    if (!cartRows.length) {
      setError(language === "fr" ? "Panier vide." : "Cart is empty.");
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
            ? "Stripe est indisponible pour le moment. Essaie le paiement manuel ou vérifie la configuration."
            : "Stripe is currently unavailable. Try manual payment or verify configuration.",
        );
        return;
      }

      setMessage(
        language === "fr"
          ? `Commande ${json.order?.orderNumber ?? ""} créée (paiement manuel).`
          : `Order ${json.order?.orderNumber ?? ""} created (manual payment).`,
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
        <nav className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/account">
            {t.navAccount}
          </Link>
          <Link className="pill-link" href="/admin">
            {t.navAdmin}
          </Link>
          <Link className="pill-link" href="/faq">
            {t.navFaq}
          </Link>
          <Link className="pill-link" href="/terms">
            {t.navTerms}
          </Link>
          <Link className="pill-link" href="/returns">
            {t.navReturns}
          </Link>
        </nav>
      </header>

      <section className="section">
        <h1>{t.checkoutTitle}</h1>
        <p className="small">{t.checkoutSubtitle}</p>
      </section>

      <section className="section">
        {cartRows.length === 0 ? (
          <p className="small">{t.cartEmpty}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === "fr" ? "Produit" : "Product"}</th>
                  <th>{language === "fr" ? "Prix" : "Price"}</th>
                  <th>{language === "fr" ? "Quantité" : "Qty"}</th>
                  <th>{language === "fr" ? "Sous-total" : "Subtotal"}</th>
                </tr>
              </thead>
              <tbody>
                {cartRows.map((row) => (
                  <tr key={row.productId}>
                    <td>{row.name}</td>
                    <td>{row.priceLabel}</td>
                    <td>{row.quantity}</td>
                    <td>{row.lineSubtotalLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 10 }}>
          <strong>
            {language === "fr" ? "Sous-total" : "Subtotal"}: {subtotalLabel}
          </strong>
        </p>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Adresse de livraison" : "Shipping address"}</h2>
        <div className="two-col">
          <div className="field">
            <label>{language === "fr" ? "Adresse" : "Address"}</label>
            <input className="input" value={shippingLine1} onChange={(e) => setShippingLine1(e.target.value)} />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Ville" : "City"}</label>
            <input className="input" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Région" : "Region"}</label>
            <input className="input" value={shippingRegion} onChange={(e) => setShippingRegion(e.target.value)} />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Code postal" : "Postal code"}</label>
            <input className="input" value={shippingPostal} onChange={(e) => setShippingPostal(e.target.value)} />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Pays" : "Country"}</label>
            <input className="input" value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>{language === "fr" ? "Paiement" : "Payment"}</label>
          <select
            className="select"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "MANUAL" | "STRIPE")}
            style={{ maxWidth: 260 }}
          >
            <option value="MANUAL">{t.manualPayment}</option>
            <option value="STRIPE">{t.stripePayment}</option>
          </select>
          <p className="small" style={{ marginTop: 6 }}>
            {paymentMethod === "MANUAL"
              ? language === "fr"
                ? "Paiement manuel: la commande est créée immédiatement et visible dans ton historique."
                : "Manual payment: order is created immediately and visible in your history."
              : language === "fr"
                ? "Stripe: tu seras redirigé vers la page de paiement sécurisée Stripe."
                : "Stripe: you will be redirected to Stripe secure checkout."}
          </p>
        </div>

        {message ? <p className="ok small">{message}</p> : null}
        {error ? <p className="err small">{error}</p> : null}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={loading} onClick={() => void submitOrder()} type="button">
            {loading ? "..." : t.placeOrder}
          </button>
        </div>
      </section>
    </div>
  );
}
