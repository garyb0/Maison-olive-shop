import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProductBySlug, getRelatedActiveProducts } from "@/lib/catalog";
import { env } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { buildProductSocialMetadata } from "@/lib/product-share";
import { Navigation } from "@/components/Navigation";
import { MobileAppChrome } from "@/components/MobileAppChrome";
import { ProductShareButton } from "@/components/ProductShareButton";
import { ProductFavoriteButton } from "@/components/ProductFavoriteButton";
import { ProductSubscriptionInlineClient } from "./product-subscription-inline-panel";
import { ProductAddToCartButton } from "./product-add-to-cart-button";
import { ProductConversionTracker } from "./product-conversion-tracker";
import { getCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { getFavoriteProductIdsForUser } from "@/lib/favorites";
import { getSellableVariantCount, getVariantSizeOptions, sumActiveVariantStock } from "@/lib/product-variants";

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

function getProductSpecLine(productSlug: string, language: "fr" | "en", primarySizeLabel?: string) {
  if (productSlug === "lit-chien-tres-grand-37x30") {
    return language === "fr"
      ? "Très grand · 95 x 75 cm · 37 x 30 po"
      : "Very large · 95 x 75 cm · 37 x 30 in";
  }

  return primarySizeLabel ?? null;
}

function getProductBenefitCopy(productSlug: string, language: "fr" | "en", categoryLabel: string, productDescription: string) {
  if (productSlug === "lit-chien-tres-grand-37x30") {
    return {
      description: productDescription,
      bestFor: language === "fr"
        ? "Un lit doux avec rebords rembourrés pour les chiens moyens à grands, ou les petits chiens qui aiment s'étendre."
        : "A soft raised-edge bed for medium to large dogs, or smaller dogs who like extra room.",
      tip: language === "fr"
        ? "Choisis d'abord la grandeur, puis la couleur. Les couleurs sans photo restent commandables avec la note photo représentative."
        : "Choose the size first, then the color. Colors without their own photo remain available with a representative-photo note.",
    };
  }

  return {
    description: productDescription,
    bestFor: language === "fr"
      ? `Produit de catégorie ${categoryLabel}, sélectionné pour une boutique animale locale fiable et simple d'utilisation.`
      : `A ${categoryLabel} item selected for a reliable, easy-to-use local pet shop.`,
    tip: language === "fr"
      ? "Combine ce produit avec d'autres essentiels de la même catégorie pour un panier plus complet."
      : "Combine this product with other essentials from the same category for a more complete basket.",
  };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const language = await getCurrentLanguage();
  const product = await getActiveProductBySlug(slug);

  if (!product) {
    return {
      title: language === "fr" ? "Produit introuvable" : "Product not found",
      alternates: {
        canonical: `/products/${slug}`,
      },
    };
  }

  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const productName = language === "fr" ? product.nameFr : product.nameEn;
  const priceLabel = formatCurrency(product.priceCents, product.currency, locale);
  const socialImageUrl = product.variants.find((variant) => variant.imageUrl)?.imageUrl ?? product.imageUrl;

  return buildProductSocialMetadata({
    language,
    slug: product.slug,
    name: productName,
    priceLabel,
    imageUrl: socialImageUrl,
    siteUrl: env.siteUrl,
  });
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

  const [relatedProducts, favoriteProductIds] = await Promise.all([
    product.categoryId
      ? getRelatedActiveProducts(product.categoryId, product.id, 4)
      : Promise.resolve([]),
    user ? getFavoriteProductIdsForUser(user.id) : Promise.resolve([]),
  ]);
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const productName = language === "fr" ? product.nameFr : product.nameEn;
  const productDescription = language === "fr" ? product.descriptionFr : product.descriptionEn;
  const categoryLabel = getCategoryLabel(product.category?.name, language);
  const categoryEmoji = getCategoryEmoji(product.category?.name);
  const priceLabel = formatCurrency(product.priceCents, product.currency, locale);
  const variants = product.variants;
  const hasVariants = variants.length > 0;
  const displayStock = hasVariants ? sumActiveVariantStock(variants) : product.stock;
  const variantCount = getSellableVariantCount(variants);
  const sizeOptions = getVariantSizeOptions(variants, language);
  const productSpecLine = getProductSpecLine(product.slug, language, sizeOptions[0]?.label);
  const benefitCopy = getProductBenefitCopy(product.slug, language, categoryLabel, productDescription);
  const availabilityLabel = hasVariants
    ? displayStock > 0
      ? language === "fr"
        ? `${variantCount} couleur${variantCount > 1 ? "s" : ""} disponible${variantCount > 1 ? "s" : ""}`
        : `${variantCount} color${variantCount > 1 ? "s" : ""} available`
      : language === "fr"
        ? "Couleurs en rupture"
        : "Colors out of stock"
    : displayStock > 0
      ? language === "fr"
        ? `${displayStock} en stock`
        : `${displayStock} available`
      : language === "fr"
        ? "Rupture de stock"
        : "Out of stock";
  const displayImageUrl = variants.find((variant) => variant.imageUrl)?.imageUrl ?? product.imageUrl;
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
    <div className="app-shell mobile-app-clone-shell product-mobile-app-shell">
      <ProductConversionTracker productId={product.id} productSlug={product.slug} language={language} />
      <MobileAppChrome language={language} userRole={user?.role ?? null} />
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <section className="section olive-product-page">
        <div className="olive-product-summary">
          <div className="olive-product-visual">
            {displayImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImageUrl} alt={productName} />
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
            {productSpecLine ? <p className="olive-product-spec-line">{productSpecLine}</p> : null}
            <p className="small olive-product-lead olive-product-lead--summary">{productDescription}</p>

            <div className="olive-product-meta">
              <div>
                <strong>{language === "fr" ? "Prix" : "Price"}</strong>
                <p>{priceLabel}</p>
              </div>
              <div>
                <strong>{language === "fr" ? "Disponibilité" : "Availability"}</strong>
                <p>
                  {availabilityLabel}
                </p>
              </div>
              <div>
                <strong>{language === "fr" ? "Catégorie" : "Category"}</strong>
                <p>{categoryLabel}</p>
              </div>
            </div>

            <div className="olive-product-highlights">
              <div className="badge">{language === "fr" ? "Livraison à domicile rapide" : "Fast home delivery"}</div>
              <div className="badge">{language === "fr" ? "Support bilingue" : "Bilingual support"}</div>
              <div className="badge">{language === "fr" ? "Sélection animale spécialisée" : "Specialized pet selection"}</div>
            </div>
          </div>

          <aside className="olive-product-purchase-card" aria-label={language === "fr" ? "Options d'achat" : "Purchase options"}>
            <div className="olive-product-purchase-head">
              <p className="home-eyebrow">{language === "fr" ? "Achat rapide" : "Quick purchase"}</p>
              <strong>{priceLabel}</strong>
              <span className={displayStock > 0 ? "olive-stock-pill olive-stock-pill--ok" : "olive-stock-pill olive-stock-pill--out"}>
                {availabilityLabel}
              </span>
            </div>
            <ProductAddToCartButton
              productId={product.id}
              productSlug={product.slug}
              productName={productName}
              language={language}
              disabled={displayStock <= 0}
              maxQuantity={displayStock}
              priceLabel={priceLabel}
              variants={variants}
            />
            <div className="olive-product-secondary-actions">
              <ProductFavoriteButton
                productId={product.id}
                initialFavorited={favoriteProductIds.includes(product.id)}
                isAuthenticated={Boolean(user)}
                language={language}
                className="olive-product-favorite"
              />
              <ProductShareButton
                slug={product.slug}
                name={productName}
                priceLabel={priceLabel}
                language={language}
                variant="product"
              />
            </div>
            {displayStock <= 0 ? (
              <p className="olive-product-unavailable-note">
                {language === "fr"
                  ? "Ce produit reste visible pour consultation, mais il ne peut pas être ajouté au panier tant que le stock n'est pas revenu."
                  : "This product remains visible for reference, but it cannot be added to cart until stock returns."}
              </p>
            ) : null}
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
                ? "Livraison à domicile à Rimouski et environs, avec suivi attentionné."
                : "Home delivery in the Rimouski area, with thoughtful follow-up."}
            </div>
            <div className="olive-product-trust-grid" aria-label={language === "fr" ? "Aide produit" : "Product help"}>
              <Link href="/faq#livraison">
                {language === "fr" ? "Livraison à domicile" : "Home delivery"}
              </Link>
              <Link href="/faq#paiement">
                {language === "fr" ? "Paiement sécurisé" : "Secure payment"}
              </Link>
              <Link href="/faq#retours">
                {language === "fr" ? "Retour / problème" : "Return / issue"}
              </Link>
            </div>
            <ProductSubscriptionInlineClient
              product={subscriptionProduct}
              language={language}
              isAuthenticated={Boolean(user)}
              initialStatus={initialSubscriptionStatus}
              googleOAuthEnabled={isGoogleOAuthConfigured()}
            />
          </aside>
        </div>
      </section>

      <section className="section olive-product-secondary-section">
        <h2>{language === "fr" ? "Pourquoi ce produit ?" : "Why this product?"}</h2>
        <div className="olive-product-benefits">
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Description détaillée" : "Detailed description"}</h3>
            <p className="small">{benefitCopy.description}</p>
          </article>
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Pour quel besoin" : "Best for"}</h3>
            <p className="small">{benefitCopy.bestFor}</p>
          </article>
          <article className="card olive-product-benefit-card">
            <h3>{language === "fr" ? "Conseil Chez Olive" : "Chez Olive tip"}</h3>
            <p className="small">{benefitCopy.tip}</p>
          </article>
        </div>
      </section>

      {relatedProducts.length > 0 ? (
        <section className="section olive-product-secondary-section">
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
