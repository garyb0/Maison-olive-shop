"use client";

import Image from "next/image";
import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { ImageSelector } from "@/components/ImageSelector";
import { toProductSlug } from "@/lib/product-slug";
import { toProductSku } from "@/lib/product-sku";
import { getSubcategoryDefinitionsForCategory } from "@/lib/product-subcategories";

type ProductRow = {
  id: string;
  slug: string;
  sku?: string;
  barcode?: string | null;
  category: string;
  subcategorySlug?: string | null;
  subcategoryNameFr?: string | null;
  subcategoryNameEn?: string | null;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl: string | null;
  priceCents: number;
  costCents?: number;
  currency: string;
  stock: number;
  isActive: boolean;
  isSubscription?: boolean;
  priceWeekly?: number | null;
  priceBiweekly?: number | null;
  priceMonthly?: number | null;
  priceQuarterly?: number | null;
  orderHistoryCount: number;
  createdAt: string;
  variants: ProductVariantRow[];
};

type ProductVariantRow = {
  id: string;
  slug: string;
  sku: string;
  barcode?: string | null;
  colorNameFr?: string | null;
  colorNameEn?: string | null;
  colorHex?: string | null;
  sizeNameFr?: string | null;
  sizeNameEn?: string | null;
  sizeCode?: string | null;
  sizeSortOrder?: number | null;
  imageUrl?: string | null;
  stock: number;
  priceCents?: number | null;
  costCents?: number | null;
  isActive: boolean;
  sortOrder: number;
};

type InventoryMovementRow = {
  id: string;
  productId: string;
  variantId?: string | null;
  productSku: string;
  variantSku?: string | null;
  productName: string;
  variantName?: string | null;
  quantityChange: number;
  reason: string;
  orderNumber: string | null;
  createdAt: string;
};

type ProductFormState = {
  id: string | null;
  slug: string;
  sku: string;
  barcode: string;
  category: string;
  subcategorySlug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl: string;
  priceCents: string;
  costCents: string;
  currency: string;
  stock: string;
  isActive: boolean;
  isSubscription: boolean;
  priceWeekly: string;
  priceBiweekly: string;
  priceMonthly: string;
  priceQuarterly: string;
};

type Props = {
  language: Language;
  products: ProductRow[];
  inventoryMovements: InventoryMovementRow[];
};

type RowFeedback = {
  type: "ok" | "error";
  text: string;
};

type ProductFilter = "ACTIVE" | "ARCHIVED" | "ALL";

const emptyProductForm: ProductFormState = {
  id: null,
  slug: "",
  sku: "",
  barcode: "",
  category: "General",
  subcategorySlug: "",
  nameFr: "",
  nameEn: "",
  descriptionFr: "",
  descriptionEn: "",
  imageUrl: "",
  priceCents: "0",
  costCents: "0",
  currency: "CAD",
  stock: "0",
  isActive: true,
  isSubscription: false,
  priceWeekly: "",
  priceBiweekly: "",
  priceMonthly: "",
  priceQuarterly: "",
};

const sortProducts = (items: ProductRow[]) =>
  [...items].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

const normalizeProductRow = (product: ProductRow) => ({
  ...product,
  variants: product.variants ?? [],
});

export function AdminProductsClient({ language, products, inventoryMovements }: Props) {
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const [productItems, setProductItems] = useState<ProductRow[]>(sortProducts(products.map(normalizeProductRow)));
  const [inventoryItems, setInventoryItems] = useState<InventoryMovementRow[]>(inventoryMovements);
  const [productFilter, setProductFilter] = useState<ProductFilter>("ACTIVE");
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback | undefined>>({});
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [productFormLoading, setProductFormLoading] = useState(false);
  const [productFormMessage, setProductFormMessage] = useState("");
  const [productFormError, setProductFormError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [stockAdjustments, setStockAdjustments] = useState<Record<string, string>>({});
  const [stockReasons, setStockReasons] = useState<Record<string, string>>({});
  const [stockLoadingId, setStockLoadingId] = useState<string | null>(null);
  const [stockMessage, setStockMessage] = useState("");
  const [stockError, setStockError] = useState("");
  const [importCsvText, setImportCsvText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [imagePreviewErrorUrl, setImagePreviewErrorUrl] = useState<string | null>(null);
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);

  const formatMoney = (cents: number, currency = "CAD") =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getDeleteBlockedMessage = () =>
    language === "fr"
      ? "Ce produit ne peut pas être supprimé car il est déjà lié à des commandes. Tu peux l’archiver pour le retirer de la vente."
      : "This product cannot be deleted because it is already linked to orders. Archive it to remove it from sale.";

  const setProductRowFeedback = (productId: string, feedback?: RowFeedback) => {
    setRowFeedback((current) => {
      const next = { ...current };
      if (!feedback) {
        delete next[productId];
        return next;
      }

      next[productId] = feedback;
      return next;
    });
  };

  const toProductRow = (product: Record<string, unknown>): ProductRow => {
    const category = (product.category ?? null) as Record<string, unknown> | string | null;
    const subcategory = (product.subcategory ?? null) as Record<string, unknown> | null;
    const counts = (product._count ?? null) as Record<string, unknown> | null;
    const variants = Array.isArray(product.variants) ? (product.variants as Record<string, unknown>[]) : [];

    return {
      id: String(product.id),
      slug: String(product.slug),
      sku: String(product.sku ?? ""),
      barcode: (product.barcode as string | null | undefined) ?? null,
      category: typeof category === "object" && category !== null ? String(category.name ?? "General") : String(category ?? "General"),
      subcategorySlug: typeof subcategory === "object" && subcategory !== null
        ? String(subcategory.slug ?? "") || null
        : (product.subcategorySlug as string | null | undefined) ?? null,
      subcategoryNameFr: typeof subcategory === "object" && subcategory !== null
        ? String(subcategory.nameFr ?? "") || null
        : (product.subcategoryNameFr as string | null | undefined) ?? null,
      subcategoryNameEn: typeof subcategory === "object" && subcategory !== null
        ? String(subcategory.nameEn ?? "") || null
        : (product.subcategoryNameEn as string | null | undefined) ?? null,
      nameFr: String(product.nameFr),
      nameEn: String(product.nameEn),
      descriptionFr: String(product.descriptionFr),
      descriptionEn: String(product.descriptionEn),
      imageUrl: (product.imageUrl as string | null | undefined) ?? null,
      priceCents: Number(product.priceCents),
      costCents: Number(product.costCents ?? 0),
      currency: String(product.currency ?? "CAD"),
      stock: Number(product.stock),
      isActive: Boolean(product.isActive),
      isSubscription: Boolean(product.isSubscription),
      priceWeekly: product.priceWeekly ? Number(product.priceWeekly) : null,
      priceBiweekly: product.priceBiweekly ? Number(product.priceBiweekly) : null,
      priceMonthly: product.priceMonthly ? Number(product.priceMonthly) : null,
      priceQuarterly: product.priceQuarterly ? Number(product.priceQuarterly) : null,
      orderHistoryCount: Number(product.orderHistoryCount ?? counts?.orderItems ?? 0),
      createdAt: typeof product.createdAt === "string" ? product.createdAt : new Date(String(product.createdAt)).toISOString(),
      variants: variants.map((variant) => ({
        id: String(variant.id),
        slug: String(variant.slug),
        sku: String(variant.sku ?? ""),
        barcode: (variant.barcode as string | null | undefined) ?? null,
        colorNameFr: (variant.colorNameFr as string | null | undefined) ?? null,
        colorNameEn: (variant.colorNameEn as string | null | undefined) ?? null,
        colorHex: (variant.colorHex as string | null | undefined) ?? null,
        sizeNameFr: (variant.sizeNameFr as string | null | undefined) ?? null,
        sizeNameEn: (variant.sizeNameEn as string | null | undefined) ?? null,
        sizeCode: (variant.sizeCode as string | null | undefined) ?? null,
        sizeSortOrder: variant.sizeSortOrder == null ? null : Number(variant.sizeSortOrder),
        imageUrl: (variant.imageUrl as string | null | undefined) ?? null,
        stock: Number(variant.stock ?? 0),
        priceCents: variant.priceCents == null ? null : Number(variant.priceCents),
        costCents: variant.costCents == null ? null : Number(variant.costCents),
        isActive: Boolean(variant.isActive),
        sortOrder: Number(variant.sortOrder ?? 0),
      })),
    };
  };

  const toMovementRow = (movement: Record<string, unknown>): InventoryMovementRow => {
    const product = (movement.product ?? {}) as Record<string, unknown>;
    const variant = (movement.variant ?? null) as Record<string, unknown> | null;
    const order = (movement.order ?? null) as Record<string, unknown> | null;
    const variantColor = variant
      ? language === "fr"
        ? String(variant.colorNameFr ?? variant.colorNameEn ?? "")
        : String(variant.colorNameEn ?? variant.colorNameFr ?? "")
      : "";
    const variantSize = variant
      ? language === "fr"
        ? String(variant.sizeNameFr ?? variant.sizeNameEn ?? variant.sizeCode ?? "")
        : String(variant.sizeNameEn ?? variant.sizeNameFr ?? variant.sizeCode ?? "")
      : "";

    return {
      id: String(movement.id),
      productId: String(movement.productId),
      variantId: (movement.variantId as string | null | undefined) ?? null,
      productSku: String(product.sku ?? ""),
      variantSku: variant?.sku ? String(variant.sku) : null,
      productName: language === "fr" ? String(product.nameFr ?? "") : String(product.nameEn ?? ""),
      variantName: variant ? [variantColor, variantSize].filter(Boolean).join(" / ") : null,
      quantityChange: Number(movement.quantityChange),
      reason: String(movement.reason),
      orderNumber: order?.orderNumber ? String(order.orderNumber) : null,
      createdAt: typeof movement.createdAt === "string" ? movement.createdAt : new Date(String(movement.createdAt)).toISOString(),
    };
  };

  const getStatusLabel = (product: ProductRow) => {
    if (product.isActive) {
      return language === "fr" ? "Actif" : "Active";
    }

    if (product.orderHistoryCount > 0) {
      return language === "fr" ? "Archivé" : "Archived";
    }

    return language === "fr" ? "Inactif" : "Inactive";
  };

  const getToggleLabel = (product: ProductRow) => {
    if (product.isActive) {
      return product.orderHistoryCount > 0
        ? language === "fr"
          ? "Archiver"
          : "Archive"
        : language === "fr"
          ? "Désactiver"
          : "Deactivate";
    }

    return language === "fr" ? "Réactiver" : "Reactivate";
  };

  const getVariantLabel = (variant: ProductVariantRow) => {
    const color = language === "fr"
      ? variant.colorNameFr ?? variant.colorNameEn ?? variant.slug
      : variant.colorNameEn ?? variant.colorNameFr ?? variant.slug;
    const size = language === "fr"
      ? variant.sizeNameFr ?? variant.sizeNameEn ?? variant.sizeCode
      : variant.sizeNameEn ?? variant.sizeNameFr ?? variant.sizeCode;

    return size ? `${color} / ${size}` : color;
  };

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
    setImagePreviewErrorUrl(null);
    setSkuManuallyEdited(false);
  };

  const updateProductImageUrl = (imageUrl: string) => {
    setImagePreviewErrorUrl(null);
    setProductForm((current) => ({ ...current, imageUrl }));
  };

  const updateProductFormWithAutoSku = (changes: Partial<ProductFormState>) => {
    setProductForm((current) => {
      const next = { ...current, ...changes };
      if (next.id || skuManuallyEdited) return next;

      const skuSeed = [next.category, next.nameFr || next.nameEn || next.slug].filter(Boolean).join(" ");
      return { ...next, sku: toProductSku(skuSeed) };
    });
  };

  const startEditingProduct = (product: ProductRow) => {
    setProductForm({
      id: product.id,
      slug: product.slug,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      category: product.category,
      subcategorySlug: product.subcategorySlug ?? "",
      nameFr: product.nameFr,
      nameEn: product.nameEn,
      descriptionFr: product.descriptionFr,
      descriptionEn: product.descriptionEn,
      imageUrl: product.imageUrl ?? "",
      priceCents: String(product.priceCents),
      costCents: String(product.costCents ?? 0),
      currency: product.currency,
      stock: String(product.stock),
      isActive: product.isActive,
      isSubscription: product.isSubscription ?? false,
      priceWeekly: product.priceWeekly?.toString() || "",
      priceBiweekly: product.priceBiweekly?.toString() || "",
      priceMonthly: product.priceMonthly?.toString() || "",
      priceQuarterly: product.priceQuarterly?.toString() || "",
    });
    setImagePreviewErrorUrl(null);
    setSkuManuallyEdited(true);
    setProductFormMessage("");
    setProductFormError("");
    setProductRowFeedback(product.id);
  };

  const saveProductToState = (product: ProductRow) => {
    const normalizedProduct = normalizeProductRow(product);
    setProductItems((current) => sortProducts([normalizedProduct, ...current.filter((item) => item.id !== product.id)]));
  };

  const submitProductForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductFormLoading(true);
    setProductFormMessage("");
    setProductFormError("");

    const normalizedSlug = toProductSlug(productForm.slug);
    if (!normalizedSlug) {
      setProductFormError(
        language === "fr"
          ? "Le slug doit contenir au moins une lettre ou un chiffre."
          : "The slug must contain at least one letter or number.",
      );
      setProductFormLoading(false);
      return;
    }

    if (normalizedSlug !== productForm.slug) {
      setProductForm((current) => ({ ...current, slug: normalizedSlug }));
    }

    const normalizedSku = toProductSku(productForm.sku);
    if (!normalizedSku) {
      setProductFormError(
        language === "fr"
          ? "Le SKU doit contenir au moins une lettre ou un chiffre."
          : "The SKU must contain at least one letter or number.",
      );
      setProductFormLoading(false);
      return;
    }

    if (normalizedSku !== productForm.sku) {
      setProductForm((current) => ({ ...current, sku: normalizedSku }));
    }

    const trimmedImageUrl = productForm.imageUrl.trim();
    const trimmedBarcode = productForm.barcode.trim().toUpperCase();
    const payload = {
      ...(productForm.id ? { id: productForm.id } : {}),
      slug: normalizedSlug,
      sku: normalizedSku,
      barcode: trimmedBarcode || null,
      category: productForm.category.trim(),
      subcategorySlug: productForm.subcategorySlug || null,
      nameFr: productForm.nameFr.trim(),
      nameEn: productForm.nameEn.trim(),
      descriptionFr: productForm.descriptionFr.trim(),
      descriptionEn: productForm.descriptionEn.trim(),
      imageUrl: trimmedImageUrl || (productForm.id ? null : undefined),
      priceCents: Number(productForm.priceCents),
      costCents: Number(productForm.costCents),
      currency: productForm.currency.trim() || "CAD",
      ...(productForm.id ? {} : { stock: Number(productForm.stock) }),
      isActive: productForm.isActive,
      isSubscription: productForm.isSubscription,
      priceWeekly: productForm.priceWeekly ? Number(productForm.priceWeekly) : null,
      priceBiweekly: productForm.priceBiweekly ? Number(productForm.priceBiweekly) : null,
      priceMonthly: productForm.priceMonthly ? Number(productForm.priceMonthly) : null,
      priceQuarterly: productForm.priceQuarterly ? Number(productForm.priceQuarterly) : null,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: productForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; product?: Record<string, unknown> };

      if (!res.ok || !data.product) {
        setProductFormError(
          data.error ?? (language === "fr" ? "Impossible d'enregistrer le produit." : "Unable to save product."),
        );
        return;
      }

      saveProductToState(toProductRow(data.product));
      setProductFormMessage(
        productForm.id
          ? language === "fr"
          ? "Produit mis à jour."
            : "Product updated."
          : language === "fr"
            ? "Produit créé."
            : "Product created.",
      );
      resetProductForm();
    } finally {
      setProductFormLoading(false);
    }
  };

  const toggleProductActive = async (product: ProductRow) => {
    setProductFormMessage("");
    setProductFormError("");
    setProductRowFeedback(product.id);

    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, isActive: !product.isActive }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string; product?: Record<string, unknown> };

    if (!res.ok || !data.product) {
      setProductRowFeedback(product.id, {
        type: "error",
        text:
          data.error ??
          (language === "fr"
            ? "Impossible de modifier le statut du produit."
            : "Unable to update product status."),
      });
      return;
    }

    saveProductToState(toProductRow(data.product));
    const message = !product.isActive
      ? language === "fr"
        ? "Produit réactivé."
        : "Product reactivated."
      : product.orderHistoryCount > 0
        ? language === "fr"
          ? "Produit archivé et retiré de la vente."
          : "Product archived and removed from sale."
        : language === "fr"
          ? "Produit désactivé."
          : "Product deactivated.";
    const nextIsActive = !product.isActive;
    const staysVisible =
      productFilter === "ALL" ||
      (productFilter === "ACTIVE" && nextIsActive) ||
      (productFilter === "ARCHIVED" && !nextIsActive);

    if (staysVisible) {
      setProductRowFeedback(product.id, { type: "ok", text: message });
    } else {
      setProductFormMessage(message);
      setProductRowFeedback(product.id);
    }
  };

  const submitStockAdjustment = async (productId: string, variantId?: string | null) => {
    const stockKey = variantId ? `${productId}:${variantId}` : productId;
    const rawQuantity = stockAdjustments[stockKey] ?? "";
    const quantityChange = Number(rawQuantity);

    setStockMessage("");
    setStockError("");

    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      setStockError(
        language === "fr" ? "Entre un ajustement de stock valide (ex: 5 ou -2)." : "Enter a valid stock adjustment (e.g. 5 or -2).",
      );
      return;
    }

    setStockLoadingId(stockKey);

    try {
      const res = await fetch("/api/admin/products/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId,
          quantityChange,
          reason: stockReasons[stockKey]?.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: Record<string, unknown>;
        movement?: Record<string, unknown>;
      };

      if (!res.ok || !data.product) {
        setStockError(data.error ?? (language === "fr" ? "Impossible d'ajuster le stock." : "Unable to adjust stock."));
        return;
      }

      saveProductToState(toProductRow(data.product));
      const movement = data.movement;
      if (movement) {
        setInventoryItems((current) => [toMovementRow(movement), ...current].slice(0, 50));
      }

      setStockAdjustments((current) => ({ ...current, [stockKey]: "" }));
      setStockReasons((current) => ({ ...current, [stockKey]: "" }));
      setStockMessage(language === "fr" ? "Stock ajusté avec succès." : "Stock updated successfully.");
    } finally {
      setStockLoadingId(null);
    }
  };

  const submitCsvImport = async (dryRun: boolean) => {
    setImportMessage("");
    setImportErrors([]);

    if (!importCsvText.trim()) {
      setImportErrors([language === "fr" ? "Colle le contenu CSV avant de lancer l'import." : "Paste CSV content before importing."]);
      return;
    }

    setImportLoading(true);

    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: importCsvText, dryRun }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        import?: {
          rows: number;
          createdProducts: number;
          updatedProducts: number;
          createdVariants: number;
          updatedVariants: number;
          stockMovements: number;
          errors: string[];
          warnings: string[];
        };
      };

      if (!res.ok || !data.import) {
        setImportErrors([data.error ?? (language === "fr" ? "Import CSV impossible." : "Unable to import CSV.")]);
        return;
      }

      setImportErrors([...data.import.errors, ...data.import.warnings]);
      setImportMessage(
        dryRun
          ? language === "fr"
            ? `Preview: ${data.import.rows} ligne(s), ${data.import.errors.length} erreur(s).`
            : `Preview: ${data.import.rows} row(s), ${data.import.errors.length} error(s).`
          : language === "fr"
            ? `Import terminé: ${data.import.createdVariants} variante(s) créées, ${data.import.updatedVariants} mise(s) à jour.`
            : `Import complete: ${data.import.createdVariants} variant(s) created, ${data.import.updatedVariants} updated.`,
      );

      if (!dryRun && data.import.errors.length === 0) {
        const refresh = await fetch("/api/admin/products");
        const refreshData = (await refresh.json().catch(() => ({}))) as { products?: Record<string, unknown>[] };
        if (refresh.ok && refreshData.products) {
          setProductItems(sortProducts(refreshData.products.map(toProductRow)));
        }
      }
    } finally {
      setImportLoading(false);
    }
  };

  const deleteProduct = async (product: ProductRow) => {
    if (product.orderHistoryCount > 0) {
      setProductRowFeedback(product.id, {
        type: "error",
        text: getDeleteBlockedMessage(),
      });
      return;
    }

    const confirmed = window.confirm(
      language === "fr"
        ? `Supprimer définitivement le produit "${product.nameFr}" ?\n\nCette action efface aussi ses mouvements d'inventaire si aucune commande n'y est liée.`
        : `Permanently delete product "${product.nameEn}"?\n\nThis also removes its inventory movements if it is not linked to any order.`,
    );

    if (!confirmed) return;

    setDeleteLoadingId(product.id);
    setProductFormMessage("");
    setProductFormError("");
    setProductRowFeedback(product.id);

    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setProductRowFeedback(product.id, {
          type: "error",
          text:
            res.status === 409
              ? getDeleteBlockedMessage()
              : data.error ??
                (language === "fr" ? "Impossible de supprimer le produit." : "Unable to delete product."),
        });
        return;
      }

      setProductItems((current) => current.filter((item) => item.id !== product.id));
      setInventoryItems((current) => current.filter((item) => item.productId !== product.id));
      setStockAdjustments((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setStockReasons((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setRowFeedback((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      if (productForm.id === product.id) {
        resetProductForm();
      }

      setProductFormMessage(language === "fr" ? "Produit supprimé définitivement." : "Product permanently deleted.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const activeCount = productItems.filter((product) => product.isActive).length;
  const archivedCount = productItems.filter((product) => !product.isActive).length;
  const activeUnavailableProducts = productItems.filter((product) => product.isActive && product.stock <= 0);
  const filteredProducts = productItems.filter((product) => {
    if (productFilter === "ACTIVE") return product.isActive;
    if (productFilter === "ARCHIVED") return !product.isActive;
    return true;
  });
  const subcategoryOptions = getSubcategoryDefinitionsForCategory(productForm.category);
  const getProductSubcategoryName = (product: ProductRow) =>
    language === "fr"
      ? product.subcategoryNameFr ?? product.subcategoryNameEn ?? "-"
      : product.subcategoryNameEn ?? product.subcategoryNameFr ?? "-";

  return (
    <>
      <section className="section admin-page-header">
        <div className="admin-page-header__copy">
          <span className="admin-page-header__eyebrow">
            {language === "fr" ? "Catalogue" : "Catalog"}
          </span>
          <h1>{language === "fr" ? "Produits & Inventaire" : "Products & Inventory"}</h1>
          <p className="small">
            {language === "fr"
              ? "Ajoute, modifie, désactive les produits et ajuste le stock sans toucher à la base manuellement."
              : "Add, edit, deactivate products and adjust stock without touching the database manually."}
          </p>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Formulaire produit" : "Product form"}</h2>
        {productFormMessage ? <p className="ok small">{productFormMessage}</p> : null}
        {productFormError ? <p className="err small">{productFormError}</p> : null}
        {stockMessage ? <p className="ok small">{stockMessage}</p> : null}
        {stockError ? <p className="err small">{stockError}</p> : null}

        <form className="section" onSubmit={submitProductForm} style={{ marginTop: 16 }}>
          <h3>
            {productForm.id
              ? language === "fr"
                ? "Modifier un produit"
                : "Edit product"
              : language === "fr"
                ? "Ajouter un produit"
                : "Add product"}
          </h3>

          <div className="two-col">
            <div className="field"><label>Slug</label><input className="input" value={productForm.slug} onChange={(e) => updateProductFormWithAutoSku({ slug: toProductSlug(e.target.value) })} required /><span className="small">{language === "fr" ? "Lettres, chiffres et tirets seulement. Exemple: test-de-commande-stripe" : "Letters, numbers, and hyphens only. Example: test-stripe-order"}</span></div>
            <div className="field"><label>SKU</label><input className="input" value={productForm.sku} onChange={(e) => { setSkuManuallyEdited(true); setProductForm((current) => ({ ...current, sku: toProductSku(e.target.value) })); }} required /><span className="small">{language === "fr" ? "Code interne stable pour l'inventaire. Exemple: FOOD-CROQ-BULL-2KG" : "Stable internal inventory code. Example: FOOD-CROQ-BULL-2KG"}</span></div>
            <div className="field"><label>{language === "fr" ? "Code-barres / UPC / EAN" : "Barcode / UPC / EAN"}</label><input className="input" value={productForm.barcode} onChange={(e) => setProductForm((current) => ({ ...current, barcode: e.target.value.toUpperCase() }))} /><span className="small">{language === "fr" ? "Optionnel; prêt pour scan plus tard." : "Optional; ready for scanning later."}</span></div>
            <div className="field"><label>{language === "fr" ? "Catégorie" : "Category"}</label><input className="input" list="product-category-suggestions" value={productForm.category} onChange={(e) => updateProductFormWithAutoSku({ category: e.target.value, subcategorySlug: "" })} required /><datalist id="product-category-suggestions">{Array.from(new Set(productItems.map((product) => product.category))).map((category) => (<option key={category} value={category} />))}<option value="Food" /><option value="Toys" /><option value="Accessories" /><option value="Hygiene" /><option value="Beds" /></datalist></div>
            <div className="field"><label>{language === "fr" ? "Sous-catégorie" : "Subcategory"}</label><select className="input" name="subcategorySlug" value={productForm.subcategorySlug} onChange={(e) => setProductForm((current) => ({ ...current, subcategorySlug: e.target.value }))} disabled={subcategoryOptions.length === 0}><option value="">{language === "fr" ? "Aucune sous-catégorie" : "No subcategory"}</option>{subcategoryOptions.map((subcategory) => (<option key={subcategory.slug} value={subcategory.slug}>{language === "fr" ? subcategory.nameFr : subcategory.nameEn}</option>))}</select><span className="small">{language === "fr" ? "Liste guidée selon la catégorie principale." : "Guided list based on the main category."}</span></div>
            <div className="field admin-product-image-field">
              <label htmlFor="admin-product-image-url">
                {language === "fr" ? "URL image (optionnel)" : "Image URL (optional)"}
              </label>
              <div className="admin-product-image-row">
                <input
                  className="input"
                  id="admin-product-image-url"
                  value={productForm.imageUrl}
                  onChange={(e) => updateProductImageUrl(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={() => setImageSelectorOpen(true)} type="button">
                  {language === "fr" ? "Choisir" : "Browse"}
                </button>
                {productForm.imageUrl ? (
                  <button className="btn btn-secondary" onClick={() => updateProductImageUrl("")} type="button">
                    {language === "fr" ? "Retirer" : "Remove"}
                  </button>
                ) : null}
              </div>
              {productForm.imageUrl ? (
                imagePreviewErrorUrl === productForm.imageUrl ? (
                  <p className="err small" style={{ marginTop: 8 }}>
                    {language === "fr"
                      ? "Impossible d'afficher cette image. Vérifie l'URL ou choisis une autre photo."
                      : "Unable to preview this image. Check the URL or choose another photo."}
                  </p>
                ) : (
                  <div className="admin-product-image-preview">
                    <Image
                      key={productForm.imageUrl}
                      src={productForm.imageUrl}
                      alt={language === "fr" ? "Aperçu du produit" : "Product preview"}
                      width={160}
                      height={106}
                      unoptimized
                      onError={() => setImagePreviewErrorUrl(productForm.imageUrl)}
                    />
                  </div>
                )
              ) : null}
            </div>
            <div className="field"><label>{language === "fr" ? "Nom FR" : "French name"}</label><input className="input" value={productForm.nameFr} onChange={(e) => setProductForm((current) => {
              const nextNameFr = e.target.value;
              const shouldSyncSlug = !current.id && (!current.slug.trim() || current.slug === toProductSlug(current.nameFr));
              const next = {
                ...current,
                nameFr: nextNameFr,
                ...(shouldSyncSlug ? { slug: toProductSlug(nextNameFr) } : {}),
              };
              if (!next.id && !skuManuallyEdited) {
                return { ...next, sku: toProductSku(`${next.category} ${nextNameFr || next.nameEn || next.slug}`) };
              }

              return next;
            })} required /></div>
            <div className="field"><label>{language === "fr" ? "Nom EN" : "English name"}</label><input className="input" value={productForm.nameEn} onChange={(e) => setProductForm((current) => ({ ...current, nameEn: e.target.value }))} required /></div>
            <div className="field"><label>{language === "fr" ? "Description FR" : "French description"}</label><textarea className="textarea" value={productForm.descriptionFr} onChange={(e) => setProductForm((current) => ({ ...current, descriptionFr: e.target.value }))} rows={4} required /></div>
            <div className="field"><label>{language === "fr" ? "Description EN" : "English description"}</label><textarea className="textarea" value={productForm.descriptionEn} onChange={(e) => setProductForm((current) => ({ ...current, descriptionEn: e.target.value }))} rows={4} required /></div>
            <div className="field"><label>{language === "fr" ? "Prix (cents)" : "Price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceCents} onChange={(e) => setProductForm((current) => ({ ...current, priceCents: e.target.value }))} required /></div>
            <div className="field"><label>{language === "fr" ? "Coût unitaire (cents)" : "Unit cost (cents)"}</label><input className="input" type="number" min={0} value={productForm.costCents} onChange={(e) => setProductForm((current) => ({ ...current, costCents: e.target.value }))} required /></div>
            <div className="field"><label>{language === "fr" ? "Devise" : "Currency"}</label><input className="input" value={productForm.currency} onChange={(e) => setProductForm((current) => ({ ...current, currency: e.target.value }))} /></div>
            {!productForm.id ? (<div className="field"><label>{language === "fr" ? "Stock initial" : "Initial stock"}</label><input className="input" type="number" min={0} value={productForm.stock} onChange={(e) => setProductForm((current) => ({ ...current, stock: e.target.value }))} required /></div>) : (<div className="field"><label>{language === "fr" ? "Stock actuel" : "Current stock"}</label><input className="input" value={productForm.stock} readOnly /><span className="small">{language === "fr" ? "Utilise l'ajustement de stock ci-dessous pour modifier l'inventaire." : "Use the stock adjustment below to change inventory."}</span></div>)}
            <div className="field"><label>{language === "fr" ? "Statut" : "Status"}</label><label className="row"><input checked={productForm.isActive} onChange={(e) => setProductForm((current) => ({ ...current, isActive: e.target.checked }))} type="checkbox" /><span>{language === "fr" ? "Produit actif" : "Active product"}</span></label></div>
            <div className="field"><label>{language === "fr" ? "Abonnement récurrent" : "Recurring subscription"}</label><label className="row"><input checked={productForm.isSubscription} onChange={(e) => setProductForm((current) => ({ ...current, isSubscription: e.target.checked }))} type="checkbox" /><span>{language === "fr" ? "Ce produit est un abonnement" : "This product is a subscription"}</span></label></div>
            {productForm.isSubscription && (<><div className="field"><label>{language === "fr" ? "Prix par semaine (cents)" : "Weekly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceWeekly} onChange={(e) => setProductForm((current) => ({ ...current, priceWeekly: e.target.value }))} placeholder="3299 pour 32,99$" /></div><div className="field"><label>{language === "fr" ? "Prix toutes les 2 semaines (cents)" : "Bi-weekly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceBiweekly} onChange={(e) => setProductForm((current) => ({ ...current, priceBiweekly: e.target.value }))} placeholder="2999 pour 29,99$" /></div><div className="field"><label>{language === "fr" ? "Prix par mois (cents)" : "Monthly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceMonthly} onChange={(e) => setProductForm((current) => ({ ...current, priceMonthly: e.target.value }))} placeholder="2799 pour 27,99$" /></div><div className="field"><label>{language === "fr" ? "Prix par trimestre (cents)" : "Quarterly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceQuarterly} onChange={(e) => setProductForm((current) => ({ ...current, priceQuarterly: e.target.value }))} placeholder="7999 pour 79,99$" /></div></>)}
          </div>

          <div className="row" style={{ marginTop: 12 }}><button className="btn" disabled={productFormLoading} type="submit">{productFormLoading ? "..." : productForm.id ? language === "fr" ? "Enregistrer les changements" : "Save changes" : language === "fr" ? "Créer le produit" : "Create product"}</button><button className="btn btn-secondary" onClick={() => { resetProductForm(); setProductFormError(""); setProductFormMessage(""); }} type="button">{language === "fr" ? "Réinitialiser" : "Reset"}</button></div>
        </form>

        <ImageSelector
          isOpen={imageSelectorOpen}
          onClose={() => setImageSelectorOpen(false)}
          onSelect={(url) => updateProductImageUrl(url)}
          language={language}
        />
      </section>

      <section className="section admin-product-import-section">
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "Import CSV variantes" : "Variant CSV import"}</h2>
            <p className="small">
              {language === "fr"
                ? "Colonnes supportées: productSlug, productSku, nameFr, nameEn, priceCents, costCents, variantSku/sku, colorNameFr, colorHex, imageUrl, stock, sizeNameFr, sizeNameEn, sizeCode, sizeSortOrder."
                : "Supported columns: productSlug, productSku, nameFr, nameEn, priceCents, costCents, variantSku/sku, colorNameFr, colorHex, imageUrl, stock, sizeNameFr, sizeNameEn, sizeCode, sizeSortOrder."}
            </p>
          </div>
          <span className="badge">{language === "fr" ? "Grandeurs prêtes, cachées en V1" : "Sizes ready, hidden in V1"}</span>
        </div>
        {importMessage ? <p className="ok small">{importMessage}</p> : null}
        {importErrors.length > 0 ? (
          <ul className="admin-import-errors">
            {importErrors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <textarea
          className="textarea admin-import-textarea"
          value={importCsvText}
          onChange={(event) => setImportCsvText(event.target.value)}
          rows={8}
          placeholder={
            "productSlug,productSku,nameFr,nameEn,priceCents,costCents,variantSku,colorNameFr,colorHex,imageUrl,stock,sizeNameFr,sizeNameEn,sizeCode,sizeSortOrder\n" +
            "lit-chien,MO-BED,Lit douillet,Cozy bed,6999,3500,MO-BED-ROUGE,Rouge,#c43,/images/lit-rouge.jpg,1,,,,"
          }
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" type="button" disabled={importLoading} onClick={() => void submitCsvImport(true)}>
            {importLoading ? "..." : language === "fr" ? "Prévisualiser" : "Preview"}
          </button>
          <button className="btn" type="button" disabled={importLoading} onClick={() => void submitCsvImport(false)}>
            {importLoading ? "..." : language === "fr" ? "Importer / mettre à jour" : "Import / update"}
          </button>
        </div>
      </section>

      {activeUnavailableProducts.length > 0 ? (
        <section className="section admin-stock-action-section" id="stock-actions" aria-labelledby="admin-stock-action-title">
          <div className="admin-section-head">
            <div>
              <h2 id="admin-stock-action-title">
                {language === "fr" ? "Produits actifs non achetables" : "Active products not buyable"}
              </h2>
              <p className="small">
                {language === "fr"
                  ? "Ces produits restent visibles, mais le checkout public demeure bloque tant que le stock est a 0."
                  : "These products remain visible, but public checkout stays blocked while stock is 0."}
              </p>
            </div>
            <span className="badge">
              {language === "fr"
                ? `${activeUnavailableProducts.length} a traiter`
                : `${activeUnavailableProducts.length} to handle`}
            </span>
          </div>

          <div className="admin-stock-action-list">
            {activeUnavailableProducts.map((product) => {
              const productName = language === "fr" ? product.nameFr : product.nameEn;
              const alternateName = language === "fr" ? product.nameEn : product.nameFr;

              return (
                <article className="admin-stock-action-row" key={product.id}>
                  <div className="admin-stock-action-copy">
                    <strong>{productName}</strong>
                    <span className="small">{alternateName}</span>
                    <div className="admin-stock-action-meta">
                      <span>SKU: {product.sku || "-"}</span>
                      <span>{product.slug}</span>
                      <span>Stock: {product.stock}</span>
                      <span className="badge">{language === "fr" ? "Achat bloque" : "Purchase blocked"}</span>
                    </div>
                  </div>

                  <div className="admin-stock-action-controls">
                    <label className="field admin-stock-action-field">
                      <span>{language === "fr" ? "Variation stock" : "Stock change"}</span>
                      <input
                        className="input"
                        placeholder={language === "fr" ? "+5 ou -2" : "+5 or -2"}
                        type="number"
                        value={stockAdjustments[product.id] ?? ""}
                        onChange={(e) =>
                          setStockAdjustments((current) => ({ ...current, [product.id]: e.target.value }))
                        }
                      />
                    </label>
                    <label className="field admin-stock-action-field admin-stock-action-field--reason">
                      <span>{language === "fr" ? "Raison" : "Reason"}</span>
                      <input
                        className="input"
                        placeholder={language === "fr" ? "Raison" : "Reason"}
                        value={stockReasons[product.id] ?? ""}
                        onChange={(e) =>
                          setStockReasons((current) => ({ ...current, [product.id]: e.target.value }))
                        }
                      />
                    </label>
                    <button
                      className="btn btn-secondary"
                      disabled={stockLoadingId === product.id}
                      onClick={() => void submitStockAdjustment(product.id)}
                      type="button"
                    >
                      {stockLoadingId === product.id ? "..." : language === "fr" ? "Ajuster" : "Adjust"}
                    </button>
                    <button className="btn" onClick={() => void toggleProductActive(product)} type="button">
                      {getToggleLabel(product)}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2>{language === "fr" ? "Liste des produits" : "Products list"}</h2>
            <p className="small" style={{ marginTop: 6 }}>
              {language === "fr"
                ? "Les produits liés à des commandes peuvent être archivés, mais pas supprimés."
                : "Products linked to orders can be archived, but not deleted."}
            </p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-secondary" href="/api/admin/inventory/export?view=snapshot">
              {language === "fr" ? "Export stock CSV" : "Stock CSV export"}
            </a>
            <a className="btn btn-secondary" href="/api/admin/inventory/export?view=movements">
              {language === "fr" ? "Export mouvements CSV" : "Movements CSV export"}
            </a>
            <button
              className={productFilter === "ACTIVE" ? "btn" : "btn btn-secondary"}
              onClick={() => setProductFilter("ACTIVE")}
              type="button"
            >
              {language === "fr" ? `Actifs (${activeCount})` : `Active (${activeCount})`}
            </button>
            <button
              className={productFilter === "ARCHIVED" ? "btn" : "btn btn-secondary"}
              onClick={() => setProductFilter("ARCHIVED")}
              type="button"
            >
              {language === "fr" ? `Archivés (${archivedCount})` : `Archived (${archivedCount})`}
            </button>
            <button
              className={productFilter === "ALL" ? "btn" : "btn btn-secondary"}
              onClick={() => setProductFilter("ALL")}
              type="button"
            >
              {language === "fr" ? `Tous (${productItems.length})` : `All (${productItems.length})`}
            </button>
          </div>
        </div>
        <div className="table-wrap admin-products-table-wrap">
          <table className="admin-products-table">
            <thead>
              <tr>
                <th>{language === "fr" ? "Produit" : "Product"}</th>
                <th>SKU</th>
                <th>Slug</th>
                <th>{language === "fr" ? "Catégorie" : "Category"}</th>
                <th>{language === "fr" ? "Sous-catégorie" : "Subcategory"}</th>
                <th>{language === "fr" ? "Prix" : "Price"}</th>
                <th>{language === "fr" ? "Stock" : "Stock"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Créé" : "Created"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const hasOrderHistory = product.orderHistoryCount > 0;
                const feedback = rowFeedback[product.id];

                return (
                  <tr key={product.id}>
                    <td className="admin-product-cell" data-label={language === "fr" ? "Produit" : "Product"}>
                      <div className="admin-product-summary">
                        <div className="admin-product-thumb">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={
                                language === "fr"
                                  ? `Photo de ${product.nameFr}`
                                  : `Photo of ${product.nameEn}`
                              }
                              width={64}
                              height={64}
                              unoptimized
                            />
                          ) : (
                            <span aria-hidden="true">CO</span>
                          )}
                        </div>
                        <div className="admin-product-summary__copy">
                          <strong>{language === "fr" ? product.nameFr : product.nameEn}</strong>
                          <div className="small">{language === "fr" ? product.nameEn : product.nameFr}</div>
                          <div className="small">SKU: {product.sku || "-"}</div>
                          {product.variants.length > 0 ? (
                            <div className="admin-product-variants-list">
                              <span className="badge">
                                {language === "fr"
                                  ? `${product.variants.length} couleur(s)`
                                  : `${product.variants.length} color(s)`}
                              </span>
                              {product.variants.slice(0, 6).map((variant) => (
                                <span className="admin-product-variant-chip" key={variant.id}>
                                  <span style={{ background: variant.colorHex || "#d8c7aa" }} aria-hidden="true" />
                                  {getVariantLabel(variant)}
                                </span>
                              ))}
                              {product.variants.length > 6 ? (
                                <span className="small">+{product.variants.length - 6}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {hasOrderHistory ? (
                            <div className="small" style={{ marginTop: 6 }}>
                              {language === "fr"
                                ? `Historique: ${product.orderHistoryCount} commande(s)`
                                : `History: ${product.orderHistoryCount} order(s)`}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td data-label="SKU">{product.sku || "-"}</td>
                    <td data-label="Slug">{product.slug}</td>
                    <td data-label={language === "fr" ? "Catégorie" : "Category"}>{product.category}</td>
                    <td data-label={language === "fr" ? "Sous-catégorie" : "Subcategory"}>{getProductSubcategoryName(product)}</td>
                    <td data-label={language === "fr" ? "Prix" : "Price"}>
                      {formatMoney(product.priceCents, product.currency)}
                      <div className="small">
                        {language === "fr" ? "Coût" : "Cost"}: {formatMoney(product.costCents ?? 0, product.currency)}
                      </div>
                    </td>
                    <td className="admin-product-stock-cell" data-label={language === "fr" ? "Stock" : "Stock"}>
                      <strong>{product.stock}</strong>
                      {product.variants.length > 0 ? (
                        <div className="admin-product-variant-stock-list">
                          {product.variants.map((variant) => {
                            const stockKey = `${product.id}:${variant.id}`;

                            return (
                              <div className="admin-product-variant-stock-row" key={variant.id}>
                                <div>
                                  <strong>{getVariantLabel(variant)}</strong>
                                  <span className="small">SKU: {variant.sku}</span>
                                </div>
                                <span className="badge">Stock: {variant.stock}</span>
                                <input
                                  className="input"
                                  placeholder={language === "fr" ? "+5 ou -2" : "+5 or -2"}
                                  type="number"
                                  value={stockAdjustments[stockKey] ?? ""}
                                  onChange={(e) =>
                                    setStockAdjustments((current) => ({ ...current, [stockKey]: e.target.value }))
                                  }
                                />
                                <input
                                  className="input"
                                  placeholder={language === "fr" ? "Raison" : "Reason"}
                                  value={stockReasons[stockKey] ?? ""}
                                  onChange={(e) =>
                                    setStockReasons((current) => ({ ...current, [stockKey]: e.target.value }))
                                  }
                                />
                                <button
                                  className="btn btn-secondary"
                                  disabled={stockLoadingId === stockKey}
                                  onClick={() => void submitStockAdjustment(product.id, variant.id)}
                                  type="button"
                                >
                                  {stockLoadingId === stockKey ? "..." : language === "fr" ? "Ajuster" : "Adjust"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="row" style={{ marginTop: 8, gap: 6 }}>
                          <input
                            className="input"
                            placeholder={language === "fr" ? "+5 ou -2" : "+5 or -2"}
                            style={{ width: 90 }}
                            type="number"
                            value={stockAdjustments[product.id] ?? ""}
                            onChange={(e) =>
                              setStockAdjustments((current) => ({ ...current, [product.id]: e.target.value }))
                            }
                          />
                          <input
                            className="input"
                            placeholder={language === "fr" ? "Raison" : "Reason"}
                            style={{ minWidth: 140 }}
                            value={stockReasons[product.id] ?? ""}
                            onChange={(e) =>
                              setStockReasons((current) => ({ ...current, [product.id]: e.target.value }))
                            }
                          />
                          <button
                            className="btn btn-secondary"
                            disabled={stockLoadingId === product.id}
                            onClick={() => void submitStockAdjustment(product.id)}
                            type="button"
                          >
                            {stockLoadingId === product.id ? "..." : language === "fr" ? "Ajuster" : "Adjust"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td data-label={language === "fr" ? "Statut" : "Status"}>
                      <span className="badge">{getStatusLabel(product)}</span>
                    </td>
                    <td data-label={language === "fr" ? "Créé" : "Created"}>{formatDateTime(product.createdAt)}</td>
                    <td className="admin-product-actions-cell" data-label={language === "fr" ? "Actions" : "Actions"}>
                      <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                        <button className="btn btn-secondary" onClick={() => startEditingProduct(product)} type="button">
                          {language === "fr" ? "Modifier" : "Edit"}
                        </button>
                        <button className="btn" onClick={() => void toggleProductActive(product)} type="button">
                          {getToggleLabel(product)}
                        </button>
                        {!hasOrderHistory ? (
                          <button
                            className="btn btn-danger"
                            disabled={deleteLoadingId === product.id}
                            onClick={() => void deleteProduct(product)}
                            type="button"
                          >
                            {deleteLoadingId === product.id
                              ? "..."
                              : language === "fr"
                                ? "Supprimer définitivement"
                                : "Delete permanently"}
                          </button>
                        ) : null}
                      </div>
                      {hasOrderHistory ? (
                        <div className="small" style={{ marginTop: 8 }}>
                          {language === "fr"
                            ? "Conserve l’historique: archive le produit pour le retirer de la vente."
                            : "Keep history: archive the product to remove it from sale."}
                        </div>
                      ) : null}
                      {feedback ? (
                        <p className={`${feedback.type === "error" ? "err" : "ok"} small`} style={{ marginTop: 8 }}>
                          {feedback.text}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Historique inventaire" : "Inventory history"}</h2>
        <p className="small">{language === "fr" ? "Mouvements récents du stock. Les commandes diminuent automatiquement l'inventaire." : "Recent stock movements. Orders automatically decrease inventory."}</p>
        <div className="table-wrap admin-inventory-table-wrap"><table className="admin-inventory-table"><thead><tr><th>SKU</th><th>{language === "fr" ? "Produit" : "Product"}</th><th>{language === "fr" ? "Variation" : "Change"}</th><th>{language === "fr" ? "Raison" : "Reason"}</th><th>{language === "fr" ? "Commande" : "Order"}</th><th>{language === "fr" ? "Date" : "Date"}</th></tr></thead><tbody>{inventoryItems.map((movement) => (<tr key={movement.id}><td data-label="SKU">{movement.variantSku || movement.productSku || "-"}</td><td data-label={language === "fr" ? "Produit" : "Product"}>{movement.variantName ? `${movement.productName} - ${movement.variantName}` : movement.productName}</td><td data-label={language === "fr" ? "Variation" : "Change"} className={movement.quantityChange >= 0 ? "ok" : "err"}>{movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}</td><td data-label={language === "fr" ? "Raison" : "Reason"}>{movement.reason}</td><td data-label={language === "fr" ? "Commande" : "Order"}>{movement.orderNumber ?? "-"}</td><td data-label={language === "fr" ? "Date" : "Date"}>{formatDateTime(movement.createdAt)}</td></tr>))}</tbody></table></div>
      </section>
    </>
  );
}




