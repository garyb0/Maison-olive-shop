import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProductBySlug, getRelatedActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";
import { ProductSubscriptionInlineClient } from "./product-subscription-inline-panel";
import { ProductAddToCartButton } from "./product-add-to-cart-button";
import { getCheckoutSession, stripeEnabled } from "@/lib/stripe";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCategoryEmoji(category?: string | null) {
  if (category === "Food" || category === "Nourriture") return "🍖";
  if (category === "Accessories" || category === "Accessoires") return "🦮";
  if (category === "Toys" || category === "Jouets") return "🪢";
  if (category === "Hygiene" || category === "Hygiène") return "🧴";
  if (category === "Beds" || category === "Literie") return "🛏️";
  return "🐾";
}

function getCategoryLabel(category: string | undefined, language: "fr" | "en") {
  const normalized = (category ?? "").trim().toLowerCase();
  const labels: Record<string, { fr: string; en: string }> = {
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
  };

  return labels[normalized]?.[language] ?? category ?? (language === "fr" ? "Produit" : "Product");
}

export default async function ProductDetailsPage({ params, searchParams }: ProductPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const user = await getCurrentUser();

  const product = await getActiveProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const relatedProducts = product.categoryId
    ? await getRelatedActiveProducts(product.categoryId, product.id, 4)
    : [];
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const productName = language === "fr" ? product.nameFr : product.nameEn;
  const productDescription = language === "fr" ? product.descriptionFr : product.descriptionEn;
  const categoryLabel = getCategoryLabel(product.category?.name, language);
  const categoryEmoji = getCategoryEmoji(product.category?.name);
  const priceLabel = formatCurrency(product.priceCents, product.currency, locale);
  const subscriptionReturnSessionId = getSearchParam(query.session_id)?.trim() ?? "";
  let initialSubscriptionStatus: "idle" | "success" | "pending" | "cancelled" =
    getSearchParam(query.canceled) === "true" ? "cancelled" : "idle";

  if (subscriptionReturnSessionId && stripeEnabled) {
    try {
      const session = await getCheckoutSession(subscriptionReturnSessionId);
      if (session?.mode === "subscription" && session.metadata?.productId === product.id) {
        initialSubscriptionStatus = session.status === "complete" ? "success" : "pending";
      }
    } catch {
      initialSubscriptionStatus = "pending";
    }
  } else if (getSearchParam(query.subscription) === "1") {
    initialSubscriptionStatus = "pending";
  }

  const subscriptionProduct = {
    id: product.id,
    slug: product.slug,
    isSubscription: product.isSubscription,
    priceWeekly: product.priceWeekly,
    priceBiweekly: product.priceBiweekly,
    priceMonthly: product.priceMonthly,
    priceQuarterly: product.priceQuarterly,
    currency: product.currency,
    nameFr: product.nameFr,
    nameEn: product.nameEn,
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <section className="section olive-product-page">
        <div className="olive-product-summary">
          <div className="olive-product-visual">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={productName} />
            ) : (
              <span aria-hidden="true">{categoryEmoji}</span>
            )}
            <div className="olive-product-visual-badge">
              {language === "fr" ? "Choisi par Olive" : "Olive pick"}
            </div>
          </div>

          <div className="olive-product-content">
            <div className="olive-product-kicker-row">
              <span className="badge olive-category-badge">{categoryEmoji} {categoryLabel}</span>
              <span className="olive-product-kicker">
                {language === "fr" ? "Sélection locale Chez Olive" : "Chez Olive local pick"}
              </span>
            </div>
            <h1>{productName}</h1>
            <p className="small olive-product-lead">{productDescription}</p>

            <div className="olive-product-meta">
              <div>
                <strong>{language === "fr" ? "Prix" : "Price"}</strong>
                <p>{priceLabel}</p>
              </div>
              <div>
                <strong>{language === "fr" ? "Disponibilité" : "Availability"}</strong>
                <p>
                  {product.stock > 0
                    ? language === "fr"
                      ? `${product.stock} en stock`
                      : `${product.stock} available`
                    : language === "fr"
                      ? "Rupture de stock"
                      : "Out of stock"}
                </p>
              </div>
              <div>
                <strong>{language === "fr" ? "Catégorie" : "Category"}</strong>
                <p>{categoryLabel}</p>
              </div>
            </div>

            <div className="olive-product-highlights">
              <div className="badge">{language === "fr" ? "Livraison locale rapide" : "Fast local delivery"}</div>
              <div className="badge">{language === "fr" ? "Support bilingue" : "Bilingual support"}</div>
              <div className="badge">{language === "fr" ? "Sélection animale spécialisée" : "Specialized pet selection"}</div>
            </div>
          </div>

          <aside className="olive-product-purchase-card" aria-label={language === "fr" ? "Options d'achat" : "Purchase options"}>
            <div className="olive-product-purchase-head">
              <p className="home-eyebrow">{language === "fr" ? "Prêt à commander" : "Ready to order"}</p>
              <strong>{priceLabel}</strong>
              <span className={product.stock > 0 ? "olive-stock-pill olive-stock-pill--ok" : "olive-stock-pill olive-stock-pill--out"}>
                {product.stock > 0
                  ? language === "fr"
                    ? `${product.stock} en stock`
                    : `${product.stock} available`
                  : language === "fr"
                    ? "Rupture de stock"
                    : "Out of stock"}
              </span>
            </div>
            <ProductAddToCartButton
              productId={product.id}
              productName={productName}
              language={language}
              disabled={product.stock <= 0}
              maxQuantity={product.stock}
            />
            <div className="olive-product-purchase-links">
              <Link className="btn btn-secondary" href="/cart">
                {language === "fr" ? "Voir le panier" : "View cart"}
              </Link>
              <Link className="btn btn-secondary" href="/boutique">
                {language === "fr" ? "Retour à la boutique" : "Back to shop"}
              </Link>
            </div>
            <div className="olive-product-purchase-note">
              <span aria-hidden="true">✓</span>
              {language === "fr"
                ? "Livraison locale à Rimouski et environs, avec suivi attentionné."
                : "Local delivery in the Rimouski area, with thoughtful follow-up."}
            </div>
            <ProductSubscriptionInlineClient
              product={subscriptionProduct}
              language={language}
              initialStatus={initialSubscriptionStatus}
            />
          </aside>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Pourquoi ce produit ?" : "Why this product?"}</h2>
        <div className="olive-product-benefits">
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Description détaillée" : "Detailed description"}</h3>
            <p className="small">{productDescription}</p>
          </article>
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Pour quel besoin" : "Best for"}</h3>
            <p className="small">
              {language === "fr"
                ? `Produit de catégorie ${categoryLabel}, sélectionné pour une boutique animale locale fiable et simple d'utilisation.`
                : `A ${categoryLabel} item selected for a reliable, easy-to-use local pet shop.`}
            </p>
          </article>
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Conseil Chez Olive" : "Chez Olive tip"}</h3>
            <p className="small">
              {language === "fr"
                ? "Combine ce produit avec d'autres essentiels de la même catégorie pour un panier plus complet."
                : "Combine this product with other essentials from the same category for a more complete basket."}
            </p>
          </article>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="section">
          <h2>{language === "fr" ? "Produits similaires" : "Related products"}</h2>
          <div className="olive-related-grid">
            {relatedProducts.map((relatedProduct) => {
              const relatedName = language === "fr" ? relatedProduct.nameFr : relatedProduct.nameEn;
              const relatedDescription = language === "fr" ? relatedProduct.descriptionFr : relatedProduct.descriptionEn;

              return (
                <article className="card olive-product-benefit-card" key={relatedProduct.id}>
                  <span className="badge olive-category-badge">
                    {getCategoryEmoji(relatedProduct.category?.name)} {getCategoryLabel(relatedProduct.category?.name, language)}
                  </span>
                  <h3>{relatedName}</h3>
                  <p className="small">{relatedDescription}</p>
                  <p>
                    <strong>{formatCurrency(relatedProduct.priceCents, relatedProduct.currency, locale)}</strong>
                  </p>
                  <Link className="btn btn-secondary" href={`/products/${relatedProduct.slug}`}>
                    {language === "fr" ? "Voir le produit" : "See product"}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
