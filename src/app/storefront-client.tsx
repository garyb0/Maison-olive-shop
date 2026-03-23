"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";

type ProductCard = {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  stock: number;
};

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
};

type Props = {
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  products: ProductCard[];
};

const CART_STORAGE_KEY = "maisonolive_cart_v1";

export function StorefrontClient({ language, t, user, products }: Props) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [languageLoading, setLanguageLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CartLine[];
        setCart(parsed);
      } catch {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((acc, line) => acc + line.quantity, 0), [cart]);

  const addToCart = (product: ProductCard) => {
    const quantity = Math.max(1, quantities[product.id] ?? 1);

    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + quantity } : line,
        );
      }
      return [...current, { productId: product.id, name: product.name, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
  };

  const updateLineQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  };

  const onLogin = async (formData: FormData) => {
    setError("");
    setMessage("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!res.ok) {
        setError(language === "fr" ? "Connexion échouée" : "Login failed");
        return;
      }

      location.reload();
    } finally {
      setLoginLoading(false);
    }
  };

  const onRegister = async (formData: FormData) => {
    setError("");
    setMessage("");
    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          language,
        }),
      });

      if (!res.ok) {
        setError(language === "fr" ? "Inscription échouée" : "Registration failed");
        return;
      }

      setMessage(language === "fr" ? "Inscription réussie. Connecte-toi." : "Registered. Please login.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.reload();
  };

  const onLanguageChange = async (nextLanguage: Language) => {
    setLanguageLoading(true);
    try {
      await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLanguage }),
      });
      location.reload();
    } finally {
      setLanguageLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="row">
          <div className="brand">{t.brandName}</div>
          <span className="badge">{language.toUpperCase()}</span>
        </div>
        <nav className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/checkout">
            {t.navCheckout}
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
        <h1>{t.heroTitle}</h1>
        <p className="small">{t.heroSubtitle}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="small">{t.language}</label>
          <select
            className="select"
            value={language}
            disabled={languageLoading}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            style={{ width: 130 }}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <span className="badge">
            {t.cart}: {cartCount}
          </span>
        </div>
      </section>

      {!user ? (
        <section className="section">
          <h2>{language === "fr" ? "Accès client" : "Customer access"}</h2>
          {message ? <p className="ok small">{message}</p> : null}
          {error ? <p className="err small">{error}</p> : null}
          <div className="two-col">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onLogin(new FormData(e.currentTarget));
              }}
            >
              <h3>{t.login}</h3>
              <div className="field">
                <label>Email</label>
                <input className="input" name="email" type="email" required />
              </div>
              <div className="field">
                <label>{language === "fr" ? "Mot de passe" : "Password"}</label>
                <input className="input" name="password" type="password" required />
              </div>
              <button className="btn" disabled={loginLoading} type="submit">
                {loginLoading ? "..." : t.login}
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onRegister(new FormData(e.currentTarget));
              }}
            >
              <h3>{t.register}</h3>
              <div className="field">
                <label>{language === "fr" ? "Prénom" : "First name"}</label>
                <input className="input" name="firstName" required />
              </div>
              <div className="field">
                <label>{language === "fr" ? "Nom" : "Last name"}</label>
                <input className="input" name="lastName" required />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" name="email" type="email" required />
              </div>
              <div className="field">
                <label>{language === "fr" ? "Mot de passe" : "Password"}</label>
                <input className="input" name="password" type="password" required />
              </div>
              <button className="btn" disabled={registerLoading} type="submit">
                {registerLoading ? "..." : t.register}
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2>
                {language === "fr" ? "Bienvenue" : "Welcome"} {user.firstName}
              </h2>
              <p className="small">{user.email}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => void onLogout()}>
              {t.logout}
            </button>
          </div>
        </section>
      )}

      <section className="section">
        <h2>{t.catalogTitle}</h2>
        <div className="grid-products">
          {products.map((product) => (
            <article className="card" key={product.id}>
              <h3>{product.name}</h3>
              <p className="small">{product.description}</p>
              <p>
                <strong>{product.priceLabel}</strong>
              </p>
              <p className="small">
                {language === "fr" ? "Stock" : "Stock"}: {product.stock}
              </p>
              <div className="row">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={Math.max(1, product.stock)}
                  value={quantities[product.id] ?? 1}
                  onChange={(e) =>
                    setQuantities((current) => ({
                      ...current,
                      [product.id]: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  style={{ width: 90 }}
                />
                <button className="btn" onClick={() => addToCart(product)} type="button">
                  {t.addToCart}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t.cart}</h2>
        {cart.length === 0 ? (
          <p className="small">{t.cartEmpty}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === "fr" ? "Produit" : "Product"}</th>
                  <th>{language === "fr" ? "Quantité" : "Quantity"}</th>
                  <th>{language === "fr" ? "Action" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.productId}>
                    <td>{line.name}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(line.productId, Math.max(1, Number(e.target.value) || 1))}
                        style={{ width: 90 }}
                      />
                    </td>
                    <td>
                      <button className="btn btn-danger" onClick={() => removeFromCart(line.productId)} type="button">
                        {language === "fr" ? "Retirer" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn" href="/checkout">
            {t.navCheckout}
          </Link>
        </div>
      </section>
    </div>
  );
}
