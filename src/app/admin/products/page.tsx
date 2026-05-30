import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminProducts, getRecentInventoryMovements } from "@/lib/admin";
import { AdminProductsClient } from "./admin-products-client";

type AdminProducts = Awaited<ReturnType<typeof getAdminProducts>>;
type AdminProduct = AdminProducts[number];
type AdminInventoryMovements = Awaited<ReturnType<typeof getRecentInventoryMovements>>;
type AdminInventoryMovement = AdminInventoryMovements[number];

export default async function AdminProductsPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  const [products, inventoryMovements] = await Promise.all([getAdminProducts(), getRecentInventoryMovements()]);

  return (
    <AdminProductsClient
      language={language}
      products={products.map((product: AdminProduct) => ({
        id: product.id,
        slug: product.slug,
        sku: product.sku ?? "",
        barcode: product.barcode,
        category: product.category?.name ?? "Uncategorized",
        subcategorySlug: product.subcategory?.slug ?? null,
        subcategoryNameFr: product.subcategory?.nameFr ?? null,
        subcategoryNameEn: product.subcategory?.nameEn ?? null,
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        costCents: product.costCents,
        currency: product.currency,
        stock: product.stock,
        isActive: product.isActive,
        isSubscription: product.isSubscription,
        priceWeekly: product.priceWeekly,
        priceBiweekly: product.priceBiweekly,
        priceMonthly: product.priceMonthly,
        priceQuarterly: product.priceQuarterly,
        orderHistoryCount: product._count.orderItems,
        createdAt: product.createdAt.toISOString(),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          slug: variant.slug,
          sku: variant.sku,
          barcode: variant.barcode,
          colorNameFr: variant.colorNameFr,
          colorNameEn: variant.colorNameEn,
          colorHex: variant.colorHex,
          sizeNameFr: variant.sizeNameFr,
          sizeNameEn: variant.sizeNameEn,
          sizeCode: variant.sizeCode,
          sizeSortOrder: variant.sizeSortOrder,
          imageUrl: variant.imageUrl,
          stock: variant.stock,
          priceCents: variant.priceCents,
          costCents: variant.costCents,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        })),
      }))}
      inventoryMovements={inventoryMovements.map((movement: AdminInventoryMovement) => ({
        id: movement.id,
        productId: movement.productId,
        variantId: movement.variantId,
        productSku: movement.product.sku ?? "",
        variantSku: movement.variant?.sku ?? null,
        productName: language === "fr" ? movement.product.nameFr : movement.product.nameEn,
        variantName: movement.variant
          ? [
              language === "fr"
                ? movement.variant.colorNameFr ?? movement.variant.colorNameEn
                : movement.variant.colorNameEn ?? movement.variant.colorNameFr,
              language === "fr"
                ? movement.variant.sizeNameFr ?? movement.variant.sizeNameEn ?? movement.variant.sizeCode
                : movement.variant.sizeNameEn ?? movement.variant.sizeNameFr ?? movement.variant.sizeCode,
            ].filter(Boolean).join(" / ")
          : null,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
        orderNumber: movement.order?.orderNumber ?? null,
        createdAt: movement.createdAt.toISOString(),
      }))}
    />
  );
}
