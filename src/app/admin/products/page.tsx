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
        category: product.category?.name ?? "Uncategorized",
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
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
      }))}
      inventoryMovements={inventoryMovements.map((movement: AdminInventoryMovement) => ({
        id: movement.id,
        productId: movement.productId,
        productName: language === "fr" ? movement.product.nameFr : movement.product.nameEn,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
        orderNumber: movement.order?.orderNumber ?? null,
        createdAt: movement.createdAt.toISOString(),
      }))}
    />
  );
}
