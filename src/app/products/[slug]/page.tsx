import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveProductBySlug, getRelatedActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { PromoBanner } from "@/components/PromoBanner";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailsPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const language = await getCurrentLanguage();
  const t = getDictionary(language);

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

  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="brand">{t.brandName}</div>
        <div className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/checkout">
            {t.navCheckout}
          </Link>
          <Link className="pill-link" href="/account">
            {t.navAccount}
          </Link>
        </div>
      </nav>

      <PromoBanner />

      <section className="section olive-product-page">
        <div className="olive-product-summary">
          <div className="olive-product-visual" aria-hidden="true">
            {product.category?.name === "Food"
              ? "🍖"
              : product.category?.name === "Accessories"
                ? "🦮"
                : product.category?.name === "Toys"
                  ? "🪢"
                  : product.category?.name === "Hygiene"
                    ? "🧴"
                    : product.category?.name === "Beds"
                      ? "🛏️"
                      : "🐾"}
          </div>

          <div className="olive-product-content">
            <span className="badge olive-category-badge">{product.category?.name}</span>
            <h1>{productName}</h1>
            <p className="small">{productDescription}</p>

            <div className="olive-product-meta">
              <div>
                <strong>{language === "fr" ? "Prix" : "Price"}</strong>
                <p>{formatCurrency(product.priceCents, product.currency, locale)}</p>
              </div>
              <div>
                <strong>{language === "fr" ? "Stock" : "Stock"}</strong>
                <p>
                  {product.stock > 0
                    ? language === "fr"
                      ? `${product.stock} disponible(s)`
                      : `${product.stock} available`
                    : language === "fr"
                      ? "Rupture de stock"
                      : "Out of stock"}
                </p>
              </div>
              <div>
                <strong>{language === "fr" ? "Slug produit" : "Product slug"}</strong>
                <p>{product.slug}</p>
              </div>
            </div>

            <div className="olive-product-highlights">
              <div className="badge">{language === "fr" ? "Livraison locale rapide" : "Fast local delivery"}</div>
              <div className="badge">{language === "fr" ? "Support bilingue" : "Bilingual support"}</div>
              <div className="badge">{language === "fr" ? "Sélection animale spécialisée" : "Specialized pet selection"}</div>
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <Link className="btn" href="/">
                {language === "fr" ? "Retour au catalogue" : "Back to catalog"}
              </Link>
              <Link className="btn btn-secondary" href="/checkout">
                {t.navCheckout}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Pourquoi ce produit ?" : "Why this product?"}</h2>
        <div className="olive-product-benefits">
          <article className="card">
            <h3>{language === "fr" ? "Description détaillée" : "Detailed description"}</h3>
            <p className="small">{productDescription}</p>
          </article>
          <article className="card">
            <h3>{language === "fr" ? "Pour quel besoin" : "Best for"}</h3>
            <p className="small">
              {language === "fr"
                ? `Produit de catégorie ${product.category?.name}, sélectionné pour une boutique animale locale fiable et simple d'utilisation.`
                : `A ${product.category?.name} item selected for a reliable, easy-to-use local pet shop.`}
            </p>
          </article>
          <article className="card">
            <h3>{language === "fr" ? "Conseil Maison Olive" : "Maison Olive tip"}</h3>
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
                <article className="card" key={relatedProduct.id}>
                  <span className="badge olive-category-badge">{relatedProduct.category?.name}</span>
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