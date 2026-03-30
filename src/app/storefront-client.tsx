"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dictionary, Language } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/types";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

type ProductCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceLabel: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

type SortBy = "newest" | "price-asc" | "price-desc" | "name-az";

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
};

type FlyItem = {
  id: string;
  x: number;
  y: number;
};

type Props = {
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  products: ProductCard[];
  oliveMode?: "princess" | "gremlin";
};

const CART_STORAGE_KEY = "maisonolive_cart_v1";

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍖",
  Nourriture: "🍖",
  Accessories: "🦮",
  Accessoires: "🦮",
  Toys: "🪢",
  Jouets: "🪢",
  Hygiene: "🧴",
  Hygiène: "🧴",
  Beds: "🛏️",
  Literie: "🛏️",
};

function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "🐾";
}

export function StorefrontClient({ language, t, user, products }: Props) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [flyItems, setFlyItems] = useState<FlyItem[]>([]);

  // ── Catalog filters ──
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");

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

  // ── Unique categories ──
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  // ── Filtered + sorted products ──
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (sortBy === "price-asc") result.sort((a, b) => a.priceCents - b.priceCents);
    else if (sortBy === "price-desc") result.sort((a, b) => b.priceCents - a.priceCents);
    else if (sortBy === "name-az") result.sort((a, b) => a.name.localeCompare(b.name));
    // "newest" keeps original server order (createdAt desc)

    return result;
  }, [products, search, categoryFilter, sortBy]);

  const addToCart = (product: ProductCard, x: number, y: number) => {
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

    const flyId = `fly-${product.id}-${Date.now()}`;
    setFlyItems((prev) => [...prev, { id: flyId, x, y }]);
    setAddingId(product.id);

    setTimeout(() => {
      setFlyItems((prev) => prev.filter((i) => i.id !== flyId));
    }, 700);
    setTimeout(() => setAddingId(null), 650);
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

  return (
    <>
      {/* Éléments volants vers le panier */}
      {flyItems.map((item) => (
        <div
          key={item.id}
          className="cart-fly-item"
          style={{ left: item.x, top: item.y }}
          aria-hidden="true"
        >
          🛒
        </div>
      ))}

      <div className="app-shell">
        <header className="topbar">
          <div className="brand">{t.brandName}</div>
          <Navigation language={language} t={t} user={user} />
        </header>

        <PromoBanner />

        {!user ? (
          <section className="section auth-section">
            <div className="auth-section-header">
              <span className="auth-section-icon">🔐</span>
              <div>
                <h2 className="auth-section-title">
                  {language === "fr" ? "Accès client" : "Customer access"}
                </h2>
                <p className="auth-section-subtitle">
                  {language === "fr"
                    ? "Connecte-toi ou crée ton compte pour accéder à tes commandes"
                    : "Sign in or create an account to access your orders"}
                </p>
              </div>
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

            <div className="auth-grid">
              {/* ── Connexion ── */}
              <div className="auth-card auth-card--login">
                <div className="auth-card-header">
                  <span className="auth-card-icon">👤</span>
                  <div>
                    <h3 className="auth-card-title">{t.login}</h3>
                    <p className="auth-card-subtitle">
                      {language === "fr" ? "Bon retour !" : "Welcome back!"}
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onLogin(new FormData(e.currentTarget));
                  }}
                >
                  <div className="field">
                    <label>Email</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">✉️</span>
                      <input className="input input--icon" name="email" type="email" placeholder="ton@email.com" required suppressHydrationWarning />
                    </div>
                  </div>
                  <div className="field">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <label>{language === "fr" ? "Mot de passe" : "Password"}</label>
                      <a
                        href="/forgot-password"
                        className="small"
                        style={{ color: "var(--muted)", fontSize: "0.78rem" }}
                      >
                        {t.forgotPassword}
                      </a>
                    </div>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input className="input input--icon" name="password" type="password" placeholder="••••••••" required suppressHydrationWarning />
                    </div>
                  </div>
                  <button className="btn btn-full" disabled={loginLoading} type="submit" suppressHydrationWarning>
                    {loginLoading
                      ? (language === "fr" ? "Connexion…" : "Signing in…")
                      : `→ ${t.login}`}
                  </button>
                </form>
              </div>

              {/* ── Diviseur ── */}
              <div className="auth-divider">
                <span className="auth-divider-line" />
                <span className="auth-divider-label">{language === "fr" ? "ou" : "or"}</span>
                <span className="auth-divider-line" />
              </div>

              {/* ── Inscription ── */}
              <div className="auth-card auth-card--register">
                <div className="auth-card-header">
                  <span className="auth-card-icon">✨</span>
                  <div>
                    <h3 className="auth-card-title">{t.register}</h3>
                    <p className="auth-card-subtitle">
                      {language === "fr" ? "Rejoins la communauté Olive" : "Join the Olive community"}
                    </p>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onRegister(new FormData(e.currentTarget));
                  }}
                >
                  <div className="auth-name-row">
                    <div className="field">
                      <label>{language === "fr" ? "Prénom" : "First name"}</label>
                      <div className="input-icon-wrap">
                        <span className="input-icon">👤</span>
                        <input className="input input--icon" name="firstName" placeholder={language === "fr" ? "Prénom" : "First name"} required suppressHydrationWarning />
                      </div>
                    </div>
                    <div className="field">
                      <label>{language === "fr" ? "Nom" : "Last name"}</label>
                      <div className="input-icon-wrap">
                        <span className="input-icon">👤</span>
                        <input className="input input--icon" name="lastName" placeholder={language === "fr" ? "Nom" : "Last name"} required suppressHydrationWarning />
                      </div>
                    </div>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">✉️</span>
                      <input className="input input--icon" name="email" type="email" placeholder="ton@email.com" required suppressHydrationWarning />
                    </div>
                  </div>
                  <div className="field">
                    <label>{language === "fr" ? "Mot de passe" : "Password"}</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input className="input input--icon" name="password" type="password" placeholder="••••••••" required suppressHydrationWarning />
                    </div>
                  </div>
                  <button className="btn btn-full btn-register" disabled={registerLoading} type="submit" suppressHydrationWarning>
                    {registerLoading
                      ? (language === "fr" ? "Création…" : "Creating…")
                      : `✨ ${t.register}`}
                  </button>
                </form>
              </div>
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

        {/* ── Catalogue ── */}
        <section className="section">
          {/* Titre + toolbar */}
          <div className="catalog-header">
            <h2>{t.catalogTitle}</h2>
          </div>

          {/* Barre de recherche + tri */}
          <div className="catalog-toolbar">
            <div className="catalog-search-wrap">
              <span className="catalog-search-icon">🔍</span>
              <input
                className="catalog-search-input"
                type="search"
                placeholder={language === "fr" ? "Rechercher un produit…" : "Search a product…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={language === "fr" ? "Rechercher" : "Search"}
              />
              {search && (
                <button
                  className="catalog-search-clear"
                  onClick={() => setSearch("")}
                  aria-label={language === "fr" ? "Effacer la recherche" : "Clear search"}
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              className="catalog-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label={language === "fr" ? "Trier par" : "Sort by"}
            >
              <option value="newest">{language === "fr" ? "Nouveautés" : "Newest"}</option>
              <option value="price-asc">{language === "fr" ? "Prix croissant" : "Price: low to high"}</option>
              <option value="price-desc">{language === "fr" ? "Prix décroissant" : "Price: high to low"}</option>
              <option value="name-az">{language === "fr" ? "Nom A → Z" : "Name A → Z"}</option>
            </select>
          </div>

          {/* Filtres par catégorie */}
          {categories.length > 0 && (
            <div className="catalog-categories" role="group" aria-label={language === "fr" ? "Filtrer par catégorie" : "Filter by category"}>
              <button
                type="button"
                className={`catalog-cat-pill${categoryFilter === "all" ? " catalog-cat-pill--active" : ""}`}
                onClick={() => setCategoryFilter("all")}
              >
                {language === "fr" ? "🐾 Tous" : "🐾 All"}
              </button>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`catalog-cat-pill${categoryFilter === cat ? " catalog-cat-pill--active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {getCategoryEmoji(cat)} {cat}
                </button>
              ))}
            </div>
          )}

          {/* Compteur de résultats */}
          <p className="catalog-results-count" aria-live="polite">
            <strong>{filteredProducts.length}</strong>{" "}
            {language === "fr"
              ? `produit${filteredProducts.length !== 1 ? "s" : ""}${search.trim() ? ` pour « ${search.trim()} »` : ""}`
              : `product${filteredProducts.length !== 1 ? "s" : ""}${search.trim() ? ` for "${search.trim()}"` : ""}`}
            {categoryFilter !== "all" && (
              <span className="catalog-active-filter">
                {" — "}
                {getCategoryEmoji(categoryFilter)} {categoryFilter}
              </span>
            )}
          </p>

          {/* Grille produits */}
          {filteredProducts.length > 0 ? (
            <div className="grid-products">
              {filteredProducts.map((product) => (
                <article
                  className={`card${addingId === product.id ? " card--adding" : ""}`}
                  key={product.id}
                >
                  {/* Visuel — image ou emoji de catégorie */}
                  <div className="card-visual">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} className="card-img" />
                    ) : (
                      <div className="card-img-emoji">{getCategoryEmoji(product.category)}</div>
                    )}
                  </div>

                  {/* Badges : catégorie + stock */}
                  <div className="card-badges-row">
                    <span className="badge">{product.category}</span>
                    {product.stock === 0 ? (
                      <span className="stock-badge stock-badge--out">
                        {language === "fr" ? "Rupture" : "Out of stock"}
                      </span>
                    ) : product.stock <= 3 ? (
                      <span className="stock-badge stock-badge--low">
                        ⚡ {language === "fr"
                          ? `${product.stock} restant${product.stock > 1 ? "s" : ""}`
                          : `${product.stock} left`}
                      </span>
                    ) : (
                      <span className="stock-badge stock-badge--in">
                        {language === "fr" ? "En stock" : "In stock"}
                      </span>
                    )}
                  </div>

                  <h3>{product.name}</h3>
                  <p className="small">{product.description}</p>
                  <p className="card-price">
                    <strong>{product.priceLabel}</strong>
                  </p>

                  {/* Ajout au panier */}
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
                      style={{ width: 80 }}
                      disabled={product.stock === 0}
                    />
                    <button
                      className="btn"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        addToCart(product, rect.left + rect.width / 2, rect.top + rect.height / 2);
                      }}
                      type="button"
                      disabled={product.stock === 0 || addingId === product.id}
                    >
                      {addingId === product.id
                        ? language === "fr"
                          ? "✓ Ajouté !"
                          : "✓ Added!"
                        : t.addToCart}
                    </button>
                  </div>

                  {/* Lien vers la fiche détaillée */}
                  <Link href={`/products/${product.slug}`} className="card-view-link">
                    {language === "fr" ? "Voir le produit →" : "View product →"}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            /* État vide */
            <div className="catalog-no-results">
              <span className="catalog-no-results-icon">🔍</span>
              <p>
                {language === "fr"
                  ? `Aucun produit trouvé${search.trim() ? ` pour « ${search.trim()} »` : ""}.`
                  : `No products found${search.trim() ? ` for "${search.trim()}"` : ""}.`}
              </p>
              {(search.trim() || categoryFilter !== "all") && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                  }}
                >
                  {language === "fr" ? "Réinitialiser les filtres" : "Reset filters"}
                </button>
              )}
            </div>
          )}
        </section>

      </div>
    </>
  );
}
