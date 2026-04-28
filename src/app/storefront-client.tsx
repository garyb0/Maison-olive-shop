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

type PromoBannerData = {
  id: string;
  isActive: boolean;
  sortOrder: number;
  badge: string;
  title: string;
  price1: string;
  price2: string;
  point1: string;
  point2: string;
  point3: string;
  ctaText: string;
  ctaLink: string;
};

type Props = {
  surface?: "home" | "shop";
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  products: ProductCard[];
  oliveMode?: "princess" | "gremlin";
  banners?: PromoBannerData[];
  initialRegisterEmail?: string;
  initialSearch?: string;
  initialCategory?: string;
};

const CART_STORAGE_KEY = "chezolive_cart_v1";

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

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  food: { fr: "Nourriture", en: "Food" },
  nourriture: { fr: "Nourriture", en: "Food" },
  accessories: { fr: "Accessoires", en: "Accessories" },
  accessoires: { fr: "Accessoires", en: "Accessories" },
  toys: { fr: "Jouets", en: "Toys" },
  jouets: { fr: "Jouets", en: "Toys" },
  hygiene: { fr: "Hygiène", en: "Hygiene" },
  "hygiène": { fr: "Hygiène", en: "Hygiene" },
  beds: { fr: "Literie", en: "Beds" },
  literie: { fr: "Literie", en: "Beds" },
  uncategorized: { fr: "Sans catégorie", en: "Uncategorized" },
  general: { fr: "Général", en: "General" },
};

const FALLBACK_CATEGORY_SHORTCUTS = [
  { key: "dogs", emoji: "🐾", fr: "Chiens", en: "Dogs" },
  { key: "cats", emoji: "🐱", fr: "Chats", en: "Cats" },
  { key: "treats", emoji: "🦴", fr: "Friandises", en: "Treats" },
  { key: "toys", emoji: "🪢", fr: "Jouets", en: "Toys" },
  { key: "beds", emoji: "🛏️", fr: "Confort", en: "Comfort" },
  { key: "care", emoji: "🧴", fr: "Soins", en: "Care" },
];

function getLocalizedCategoryLabel(category: string, language: Language): string {
  const normalized = category.trim().toLowerCase();
  return CATEGORY_LABELS[normalized]?.[language] ?? category;
}

export function StorefrontClient({
  surface = "home",
  language,
  t,
  user,
  products,
  banners = [],
  initialRegisterEmail = "",
  initialSearch = "",
  initialCategory = "",
}: Props) {
  const isShopSurface = surface === "shop";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginTwoFactorRequired, setLoginTwoFactorRequired] = useState(false);
  const [loginTwoFactorCode, setLoginTwoFactorCode] = useState("");
  const [loginTwoFactorRole, setLoginTwoFactorRole] = useState<"CUSTOMER" | "ADMIN" | null>(null);
  const [registerEmail, setRegisterEmail] = useState(initialRegisterEmail);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [flyItems, setFlyItems] = useState<FlyItem[]>([]);

  // ── Catalog filters ──
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory || "all");
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

  useEffect(() => {
    const handleCatalogSearch = (event: Event) => {
      const nextSearch =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "";

      setSearch(nextSearch);
      setCategoryFilter("all");
    };

    window.addEventListener("chezolive:catalog-search", handleCatalogSearch);
    return () => window.removeEventListener("chezolive:catalog-search", handleCatalogSearch);
  }, []);

  useEffect(() => {
    setSearch(initialSearch);
    setCategoryFilter(initialCategory || "all");
  }, [initialCategory, initialSearch]);

  // ── Unique categories ──
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const heroCategoryItems = useMemo(() => {
    if (categories.length > 0) {
      return categories.slice(0, 6).map((category) => ({
        key: category,
        value: category,
        emoji: getCategoryEmoji(category),
        label: getLocalizedCategoryLabel(category, language),
        isFilterable: true,
      }));
    }

    return FALLBACK_CATEGORY_SHORTCUTS.map((category) => ({
      key: category.key,
      value: category.key,
      emoji: category.emoji,
      label: language === "fr" ? category.fr : category.en,
      isFilterable: false,
    }));
  }, [categories, language]);

  const marketHighlights = useMemo(() => [
    {
      value: products.length > 0 ? String(products.length) : language === "fr" ? "Bientôt" : "Soon",
      label: language === "fr" ? "produits actifs" : "active products",
    },
    {
      value: categories.length > 0 ? String(categories.length) : "6",
      label: language === "fr" ? "rayons animaux" : "pet departments",
    },
    {
      value: "Rimouski",
      label: language === "fr" ? "livraison locale" : "local delivery",
    },
  ], [categories.length, language, products.length]);

  const localPromiseCards = useMemo(() => [
    {
      title: language === "fr" ? "Essentiels choisis" : "Curated essentials",
      text: language === "fr"
        ? "Nourriture, confort, soins et jeux pour les routines du quotidien."
        : "Food, comfort, care, and play for everyday routines.",
    },
    {
      title: language === "fr" ? "Marché local" : "Local market",
      text: language === "fr"
        ? "Une boutique pensée pour mettre les produits de la région en avant."
        : "A shop made to put regional products forward.",
    },
    {
      title: language === "fr" ? "Achat rassurant" : "Easy checkout",
      text: language === "fr"
        ? "Livraison locale, paiement sécurisé et suivi clair de la commande."
        : "Local delivery, secure payment, and clear order follow-up.",
    },
  ], [language]);

  const featuredProducts = useMemo(
    () => products.filter((product) => product.stock > 0).slice(0, 4),
    [products],
  );

  const getCategoryHref = (category: { value: string; label: string; isFilterable: boolean }) => {
    const params = new URLSearchParams();
    params.set(category.isFilterable ? "category" : "q", category.isFilterable ? category.value : category.label);
    return `/boutique?${params.toString()}`;
  };

  // ── Filtered + sorted products ──
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          getLocalizedCategoryLabel(p.category, language).toLowerCase().includes(q),
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
  }, [products, search, categoryFilter, sortBy, language]);

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
      if (loginTwoFactorRequired) {
        const response = await fetch("/api/auth/login/verify-two-factor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: loginTwoFactorCode }),
        });

        if (!response.ok) {
          setError(language === "fr" ? "Code de vérification invalide" : "Invalid verification code");
          return;
        }

        if (loginTwoFactorRole === "ADMIN") {
          location.href = "/admin";
          return;
        }

        location.reload();
        return;
      }

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

      const payload = (await res.json().catch(() => ({}))) as { requiresTwoFactor?: boolean; role?: "CUSTOMER" | "ADMIN" };
      if (payload.requiresTwoFactor) {
        setLoginTwoFactorRequired(true);
        setLoginTwoFactorRole(payload.role ?? null);
        setLoginTwoFactorCode("");
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
      setRegisterEmail("");
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

      <div className={`app-shell ${isShopSurface ? "app-shell--shop" : "app-shell--home"}`}>
        <header className="topbar">
          <Navigation
            language={language}
            t={t}
            user={user}
            catalogCategories={
              isShopSurface
                ? categories.map((category) => ({
                    value: category,
                    label: getLocalizedCategoryLabel(category, language),
                    emoji: getCategoryEmoji(category),
                  }))
                : undefined
            }
          />
        </header>

        {!isShopSurface ? <PromoBanner language={language} banners={banners} /> : null}

        {isShopSurface ? null : (
          <>
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/chez-olive/family-dogs.png"
              alt={
                language === "fr"
                  ? "Les chiens de la famille Chez Olive à la fenêtre"
                  : "The Chez Olive family dogs by the window"
              }
            />
            <div className="home-hero-stamp">
              {language === "fr" ? "Approuvé par Olive" : "Olive approved"}
            </div>
          </div>

          <div className="home-hero-copy">
            <p className="home-eyebrow">
              {language === "fr" ? "Marketplace locale animalière" : "Local pet marketplace"}
            </p>
            <h1 id="home-hero-title">
              {language === "fr"
                ? "De notre famille à la vôtre"
                : "From our family to yours"}
            </h1>
            <p className="home-hero-text">
              {language === "fr"
                ? "Des produits choisis avec soin pour vos chiens et chats, des entreprises d’ici, et une expérience d’achat simple, chaleureuse et fiable."
                : "Carefully selected products for your dogs and cats, local businesses, and a simple, warm, reliable shopping experience."}
            </p>
            <div className="home-hero-actions">
              <Link className="btn home-hero-primary" href="/boutique">
                {language === "fr" ? "Magasiner maintenant" : "Shop now"}
              </Link>
              <Link className="btn btn-secondary home-hero-secondary" href="/sell">
                {language === "fr" ? "Découvrir les entreprises locales" : "Discover local businesses"}
              </Link>
            </div>
            <div className="home-category-strip" aria-label={language === "fr" ? "Catégories en vedette" : "Featured categories"}>
              {heroCategoryItems.map((category) =>
                category.isFilterable ? (
                  <Link
                    key={category.key}
                    className="home-category-chip"
                    href={getCategoryHref(category)}
                  >
                    <span aria-hidden="true">{category.emoji}</span>
                    {category.label}
                  </Link>
                ) : (
                  <Link className="home-category-chip" href={getCategoryHref(category)} key={category.key}>
                    <span aria-hidden="true">{category.emoji}</span>
                    {category.label}
                  </Link>
                ),
              )}
            </div>
          </div>

          <aside className="home-hero-note" aria-label={language === "fr" ? "Message d'Olive" : "Message from Olive"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/selfie.png"
              alt={language === "fr" ? "Selfie d'Olive" : "Olive selfie"}
            />
            <strong>{language === "fr" ? "Olive vous recommande ses coups de cœur !" : "Olive recommends her favorites!"}</strong>
          </aside>
        </section>

        <section className="home-trust-band" aria-label={language === "fr" ? "Avantages Chez Olive" : "Chez Olive benefits"}>
          <article>
            <span aria-hidden="true">🚚</span>
            <strong>{language === "fr" ? "Livraison locale" : "Local delivery"}</strong>
            <small>{language === "fr" ? "Rimouski et environs" : "Rimouski area"}</small>
          </article>
          <article>
            <span aria-hidden="true">🔒</span>
            <strong>{language === "fr" ? "Paiement sécurisé" : "Secure payment"}</strong>
            <small>{language === "fr" ? "Visa, Mastercard ou paiement local" : "Visa, Mastercard, or local payment"}</small>
          </article>
          <article>
            <span aria-hidden="true">💚</span>
            <strong>{language === "fr" ? "Service attentionné" : "Thoughtful support"}</strong>
            <small>{language === "fr" ? "Une équipe d’ici" : "A local team"}</small>
          </article>
        </section>

        <section className="home-market-overview" aria-label={language === "fr" ? "Aperçu marketplace" : "Marketplace overview"}>
          <div className="home-market-copy">
            <p className="home-eyebrow">
              {language === "fr" ? "Boutique locale" : "Local shop"}
            </p>
            <h2>
              {language === "fr"
                ? "Trouver vite les essentiels de votre compagnon."
                : "Find your companion’s essentials quickly."}
            </h2>
            <p>
              {language === "fr"
                ? "Des produits sélectionnés pour chiens et chats, avec livraison locale à Rimouski et paiement sécurisé."
                : "Selected products for dogs and cats, with local Rimouski delivery and secure payment."}
            </p>
          </div>

          <div className="home-market-stats">
            {marketHighlights.map((item) => (
              <article key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>

          <div className="home-local-promises">
            {localPromiseCards.map((card) => (
              <article key={card.title}>
                <strong>{card.title}</strong>
                <span>{card.text}</span>
              </article>
            ))}
          </div>
        </section>

        {featuredProducts.length > 0 ? (
          <section className="home-product-rail" aria-labelledby="home-product-rail-title">
            <div className="home-section-head">
              <div>
                <p className="home-eyebrow">
                  {language === "fr" ? "Coups de cœur" : "Favorites"}
                </p>
                <h2 id="home-product-rail-title">
                  {language === "fr" ? "Disponibles maintenant" : "Available now"}
                </h2>
              </div>
              <Link className="home-section-link" href="/boutique">
                {language === "fr" ? "Voir toute la boutique" : "View full shop"}
              </Link>
            </div>

            <div className="home-rail-grid">
              {featuredProducts.map((product) => (
                <article className="home-rail-card" key={product.id}>
                  <Link className="home-rail-visual" href={`/products/${product.slug}`}>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span aria-hidden="true">{getCategoryEmoji(product.category)}</span>
                    )}
                  </Link>
                  <div className="home-rail-copy">
                    <span className="home-rail-category">
                      {getLocalizedCategoryLabel(product.category, language)}
                    </span>
                    <Link className="home-rail-name" href={`/products/${product.slug}`}>
                      {product.name}
                    </Link>
                    <div className="home-rail-bottom">
                      <strong>{product.priceLabel}</strong>
                      <button
                        className="home-rail-add"
                        type="button"
                        disabled={addingId === product.id}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          addToCart(product, rect.left + rect.width / 2, rect.top + rect.height / 2);
                        }}
                      >
                        {addingId === product.id
                          ? language === "fr" ? "Ajouté" : "Added"
                          : language === "fr" ? "Ajouter" : "Add"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
                  {loginTwoFactorRequired ? (
                    <div className="field">
                      <label>{language === "fr" ? "Code de vérification" : "Verification code"}</label>
                      <div className="input-icon-wrap">
                        <span className="input-icon">🔐</span>
                        <input
                          className="input input--icon"
                          value={loginTwoFactorCode}
                          onChange={(event) => setLoginTwoFactorCode(event.target.value)}
                          placeholder={language === "fr" ? "123456 ou code de secours" : "123456 or backup code"}
                          autoComplete="one-time-code"
                          required
                          suppressHydrationWarning
                        />
                      </div>
                      <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
                        {language === "fr"
                          ? "Entre le code de ton application d’authentification ou un code de secours."
                          : "Enter a code from your authenticator app or a backup code."}
                      </p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                  <button className="btn btn-full" disabled={loginLoading} type="submit" suppressHydrationWarning>
                    {loginLoading
                      ? (language === "fr" ? "Connexion…" : "Signing in…")
                      : loginTwoFactorRequired
                        ? (language === "fr" ? "Vérifier le code" : "Verify code")
                        : `→ ${t.login}`}
                  </button>
                  {loginTwoFactorRequired ? (
                    <button
                      className="btn btn-full btn-secondary"
                      type="button"
                      onClick={() => {
                        setLoginTwoFactorRequired(false);
                        setLoginTwoFactorRole(null);
                        setLoginTwoFactorCode("");
                        setError("");
                      }}
                      suppressHydrationWarning
                      style={{ marginTop: 10 }}
                    >
                      {language === "fr" ? "Retour" : "Back"}
                    </button>
                  ) : null}
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
                  {initialRegisterEmail && registerEmail === initialRegisterEmail ? (
                    <div className="auth-alert auth-alert--ok" style={{ marginBottom: "1rem" }}>
                      <span>✨</span>
                      {language === "fr"
                        ? "On a prérempli ton courriel pour créer ton compte après la commande."
                        : "Your email has been prefilled so you can create your account after ordering."}
                    </div>
                  ) : null}
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
                      <input
                        className="input input--icon"
                        name="email"
                        type="email"
                        placeholder="ton@email.com"
                        value={registerEmail}
                        onChange={(event) => setRegisterEmail(event.target.value)}
                        required
                        suppressHydrationWarning
                      />
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
          </>
        )}

        {/* ── Catalogue ── */}
        {isShopSurface ? (
        <section className="section catalog-section" id="catalogue">
          {/* Titre + toolbar */}
          <div className="catalog-header">
            <div>
              <p className="home-eyebrow">
                {language === "fr" ? "Boutique locale" : "Local shop"}
              </p>
              <h2>{t.catalogTitle}</h2>
            </div>
          </div>

          {/* Barre de recherche + tri */}
          <div className="catalog-toolbar">
            <div className="catalog-search-wrap">
              <span className="catalog-search-icon">🔍</span>
              <input
                id="catalog-search"
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

          <div className="catalog-market-layout">
            {categories.length > 0 && (
              <aside className="catalog-side-panel" aria-label={language === "fr" ? "Catégories du catalogue" : "Catalog categories"}>
                <h3>{language === "fr" ? "Toutes les catégories" : "All categories"}</h3>
                <button
                  type="button"
                  className={`catalog-side-link${categoryFilter === "all" ? " catalog-side-link--active" : ""}`}
                  onClick={() => setCategoryFilter("all")}
                >
                  <span>{language === "fr" ? "Tout le catalogue" : "Full catalog"}</span>
                  <span aria-hidden="true">→</span>
                </button>
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    className={`catalog-side-link${categoryFilter === cat ? " catalog-side-link--active" : ""}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    <span>
                      <span aria-hidden="true">{getCategoryEmoji(cat)}</span>{" "}
                      {getLocalizedCategoryLabel(cat, language)}
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </aside>
            )}

            <div className="catalog-products-panel">
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
                  {getCategoryEmoji(cat)} {getLocalizedCategoryLabel(cat, language)}
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
                {getCategoryEmoji(categoryFilter)} {getLocalizedCategoryLabel(categoryFilter, language)}
              </span>
            )}
          </p>

          {/* Grille produits */}
          {filteredProducts.length > 0 ? (
            <div className="grid-products">
              {filteredProducts.map((product) => (
                <article
                  className={`catalog-product-card${addingId === product.id ? " catalog-product-card--adding" : ""}`}
                  key={product.id}
                >
                  {/* Visuel — image ou emoji de catégorie */}
                  <Link className="catalog-product-media" href={`/products/${product.slug}`}>
                    <span className="catalog-product-category">
                      {getLocalizedCategoryLabel(product.category, language)}
                    </span>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} className="catalog-product-img" />
                    ) : (
                      <span className="catalog-product-emoji" aria-hidden="true">{getCategoryEmoji(product.category)}</span>
                    )}
                  </Link>

                  {/* Badges : catégorie + stock */}
                  <div className="catalog-product-meta">
                    {product.stock === 0 ? (
                      <span className="catalog-stock-pill catalog-stock-pill--out">
                        {language === "fr" ? "Rupture" : "Out of stock"}
                      </span>
                    ) : product.stock <= 3 ? (
                      <span className="catalog-stock-pill catalog-stock-pill--low">
                        {language === "fr"
                          ? `${product.stock} restant${product.stock > 1 ? "s" : ""}`
                          : `${product.stock} left`}
                      </span>
                    ) : (
                      <span className="catalog-stock-pill catalog-stock-pill--in">
                        {language === "fr" ? "En stock" : "In stock"}
                      </span>
                    )}
                  </div>

                  <div className="catalog-product-copy">
                    <Link href={`/products/${product.slug}`} className="catalog-product-name">
                      {product.name}
                    </Link>
                    <p className="catalog-product-seller">Chez Olive &middot; Rimouski</p>
                    <p className="catalog-product-rating" aria-label={language === "fr" ? "Note cinq etoiles" : "Five star rating"}>
                      <span aria-hidden="true">★★★★★</span>
                    </p>
                  </div>

                  {/* Ajout au panier */}
                  <div className="catalog-product-footer">
                    <strong className="catalog-product-price">{product.priceLabel}</strong>
                    <div className="catalog-product-actions">
                      <input
                        className="catalog-product-qty"
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
                        disabled={product.stock === 0}
                        aria-label={language === "fr" ? `Quantité pour ${product.name}` : `Quantity for ${product.name}`}
                      />
                      <button
                        className="catalog-product-add"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          addToCart(product, rect.left + rect.width / 2, rect.top + rect.height / 2);
                        }}
                        type="button"
                        disabled={product.stock === 0 || addingId === product.id}
                      >
                        {product.stock === 0
                          ? language === "fr"
                            ? "Indisponible"
                            : "Unavailable"
                          : addingId === product.id
                            ? language === "fr"
                              ? "Ajouté"
                              : "Added"
                            : t.addToCart}
                      </button>
                    </div>
                  </div>

                  {/* Lien vers la fiche détaillée */}
                  <Link href={`/products/${product.slug}`} className="catalog-product-view">
                    {language === "fr" ? "Voir le produit →" : "View product →"}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            /* État vide */
            <div className="catalog-no-results">
              <span className="catalog-no-results-icon">🔍</span>
              {products.length === 0 && !search.trim() && categoryFilter === "all" ? (
                <>
                  <p>
                    {language === "fr"
                      ? "La boutique est en préparation. Les produits seront ajoutés très bientôt."
                      : "The shop is being prepared. Products will be added very soon."}
                  </p>
                  <p className="small" style={{ marginTop: 8 }}>
                    {language === "fr"
                      ? "Ton compte et le checkout sont déjà prêts pour le lancement."
                      : "Your account and checkout are already prepared for launch."}
                  </p>
                </>
              ) : (
                <p>
                  {language === "fr"
                    ? `Aucun produit trouve${search.trim() ? ` pour « ${search.trim()} »` : ""}.`
                    : `No products found${search.trim() ? ` for "${search.trim()}"` : ""}.`}
                </p>
              )}
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
            </div>
          </div>
        </section>
        ) : null}

      </div>
    </>
  );
}



