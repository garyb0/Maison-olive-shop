"use client";

import Image from "next/image";
import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { ImageSelector } from "@/components/ImageSelector";
import { toProductSlug } from "@/lib/product-slug";

type ProductRow = {
  id: string;
  slug: string;
  category: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl: string | null;
  priceCents: number;
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
};

type InventoryMovementRow = {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number;
  reason: string;
  orderNumber: string | null;
  createdAt: string;
};

type ProductFormState = {
  id: string | null;
  slug: string;
  category: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl: string;
  priceCents: string;
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
  category: "General",
  nameFr: "",
  nameEn: "",
  descriptionFr: "",
  descriptionEn: "",
  imageUrl: "",
  priceCents: "0",
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

export function AdminProductsClient({ language, products, inventoryMovements }: Props) {
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const [productItems, setProductItems] = useState<ProductRow[]>(sortProducts(products));
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
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);

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
    const counts = (product._count ?? null) as Record<string, unknown> | null;

    return {
      id: String(product.id),
      slug: String(product.slug),
      category: typeof category === "object" && category !== null ? String(category.name ?? "General") : String(category ?? "General"),
      nameFr: String(product.nameFr),
      nameEn: String(product.nameEn),
      descriptionFr: String(product.descriptionFr),
      descriptionEn: String(product.descriptionEn),
      imageUrl: (product.imageUrl as string | null | undefined) ?? null,
      priceCents: Number(product.priceCents),
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
    };
  };

  const toMovementRow = (movement: Record<string, unknown>): InventoryMovementRow => {
    const product = (movement.product ?? {}) as Record<string, unknown>;
    const order = (movement.order ?? null) as Record<string, unknown> | null;

    return {
      id: String(movement.id),
      productId: String(movement.productId),
      productName: language === "fr" ? String(product.nameFr ?? "") : String(product.nameEn ?? ""),
      quantityChange: Number(movement.quantityChange),
      reason: String(movement.reason),
      orderNumber: order?.orderNumber ? String(order.orderNumber) : null,
      createdAt: typeof movement.createdAt === "string" ? movement.createdAt : new Date(String(movement.createdAt)).toISOString(),
    };
  };

  const getStatusLabel = (product: ProductRow) => {
    if (product.isActive) {
      return language === "fr" ? "ACTIF" : "ACTIVE";
    }

    if (product.orderHistoryCount > 0) {
      return language === "fr" ? "ARCHIVÉ" : "ARCHIVED";
    }

    return language === "fr" ? "INACTIF" : "INACTIVE";
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

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
  };

  const startEditingProduct = (product: ProductRow) => {
    setProductForm({
      id: product.id,
      slug: product.slug,
      category: product.category,
      nameFr: product.nameFr,
      nameEn: product.nameEn,
      descriptionFr: product.descriptionFr,
      descriptionEn: product.descriptionEn,
      imageUrl: product.imageUrl ?? "",
      priceCents: String(product.priceCents),
      currency: product.currency,
      stock: String(product.stock),
      isActive: product.isActive,
      isSubscription: product.isSubscription ?? false,
      priceWeekly: product.priceWeekly?.toString() || "",
      priceBiweekly: product.priceBiweekly?.toString() || "",
      priceMonthly: product.priceMonthly?.toString() || "",
      priceQuarterly: product.priceQuarterly?.toString() || "",
    });
    setProductFormMessage("");
    setProductFormError("");
    setProductRowFeedback(product.id);
  };

  const saveProductToState = (product: ProductRow) => {
    setProductItems((current) => sortProducts([product, ...current.filter((item) => item.id !== product.id)]));
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

    const payload = {
      ...(productForm.id ? { id: productForm.id } : {}),
      slug: normalizedSlug,
      category: productForm.category.trim(),
      nameFr: productForm.nameFr.trim(),
      nameEn: productForm.nameEn.trim(),
      descriptionFr: productForm.descriptionFr.trim(),
      descriptionEn: productForm.descriptionEn.trim(),
      imageUrl: productForm.imageUrl.trim() || undefined,
      priceCents: Number(productForm.priceCents),
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

  const submitStockAdjustment = async (productId: string) => {
    const rawQuantity = stockAdjustments[productId] ?? "";
    const quantityChange = Number(rawQuantity);

    setStockMessage("");
    setStockError("");

    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      setStockError(
        language === "fr" ? "Entre un ajustement de stock valide (ex: 5 ou -2)." : "Enter a valid stock adjustment (e.g. 5 or -2).",
      );
      return;
    }

    setStockLoadingId(productId);

    try {
      const res = await fetch("/api/admin/products/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantityChange,
          reason: stockReasons[productId]?.trim() || undefined,
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

      setStockAdjustments((current) => ({ ...current, [productId]: "" }));
      setStockReasons((current) => ({ ...current, [productId]: "" }));
      setStockMessage(language === "fr" ? "Stock ajusté avec succès." : "Stock updated successfully.");
    } finally {
      setStockLoadingId(null);
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
  const filteredProducts = productItems.filter((product) => {
    if (productFilter === "ACTIVE") return product.isActive;
    if (productFilter === "ARCHIVED") return !product.isActive;
    return true;
  });

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Produits & Inventaire" : "Products & Inventory"}</h1>
        <p className="small">
          {language === "fr"
            ? "Ajoute, modifie, désactive les produits et ajuste le stock sans toucher à la base manuellement."
            : "Add, edit, deactivate products and adjust stock without touching the database manually."}
        </p>
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
            <div className="field"><label>Slug</label><input className="input" value={productForm.slug} onChange={(e) => setProductForm((current) => ({ ...current, slug: toProductSlug(e.target.value) }))} required /><span className="small">{language === "fr" ? "Lettres, chiffres et tirets seulement. Exemple: test-de-commande-stripe" : "Letters, numbers, and hyphens only. Example: test-stripe-order"}</span></div>
            <div className="field"><label>{language === "fr" ? "Catégorie" : "Category"}</label><input className="input" list="product-category-suggestions" value={productForm.category} onChange={(e) => setProductForm((current) => ({ ...current, category: e.target.value }))} required /><datalist id="product-category-suggestions">{Array.from(new Set(productItems.map((product) => product.category))).map((category) => (<option key={category} value={category} />))}<option value="Food" /><option value="Toys" /><option value="Accessories" /><option value="Hygiene" /><option value="Beds" /></datalist></div>
            <div className="field"><label>{language === "fr" ? "URL image (optionnel)" : "Image URL (optional)"}</label><div className="row" style={{ gap: 8, alignItems: "flex-end" }}><input className="input" value={productForm.imageUrl} onChange={(e) => setProductForm((current) => ({ ...current, imageUrl: e.target.value }))} style={{ flex: 1 }} /><button className="btn btn-secondary" onClick={() => setImageSelectorOpen(true)} type="button" style={{ whiteSpace: "nowrap" }}>{language === "fr" ? "Choisir" : "Browse"}</button></div>{productForm.imageUrl && (<div style={{ marginTop: 8 }}><Image src={productForm.imageUrl} alt="Apercu" width={120} height={80} style={{ maxWidth: "120px", maxHeight: "80px", objectFit: "contain", borderRadius: "4px", border: "1px solid #e5e7eb" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /></div>)}</div>
            <div className="field"><label>{language === "fr" ? "Nom FR" : "French name"}</label><input className="input" value={productForm.nameFr} onChange={(e) => setProductForm((current) => {
              const nextNameFr = e.target.value;
              const shouldSyncSlug = !current.id && (!current.slug.trim() || current.slug === toProductSlug(current.nameFr));
              return {
                ...current,
                nameFr: nextNameFr,
                ...(shouldSyncSlug ? { slug: toProductSlug(nextNameFr) } : {}),
              };
            })} required /></div>
            <div className="field"><label>{language === "fr" ? "Nom EN" : "English name"}</label><input className="input" value={productForm.nameEn} onChange={(e) => setProductForm((current) => ({ ...current, nameEn: e.target.value }))} required /></div>
            <div className="field"><label>{language === "fr" ? "Description FR" : "French description"}</label><textarea className="textarea" value={productForm.descriptionFr} onChange={(e) => setProductForm((current) => ({ ...current, descriptionFr: e.target.value }))} rows={4} required /></div>
            <div className="field"><label>{language === "fr" ? "Description EN" : "English description"}</label><textarea className="textarea" value={productForm.descriptionEn} onChange={(e) => setProductForm((current) => ({ ...current, descriptionEn: e.target.value }))} rows={4} required /></div>
            <div className="field"><label>{language === "fr" ? "Prix (cents)" : "Price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceCents} onChange={(e) => setProductForm((current) => ({ ...current, priceCents: e.target.value }))} required /></div>
            <div className="field"><label>{language === "fr" ? "Devise" : "Currency"}</label><input className="input" value={productForm.currency} onChange={(e) => setProductForm((current) => ({ ...current, currency: e.target.value }))} /></div>
            {!productForm.id ? (<div className="field"><label>{language === "fr" ? "Stock initial" : "Initial stock"}</label><input className="input" type="number" min={0} value={productForm.stock} onChange={(e) => setProductForm((current) => ({ ...current, stock: e.target.value }))} required /></div>) : (<div className="field"><label>{language === "fr" ? "Stock actuel" : "Current stock"}</label><input className="input" value={productForm.stock} readOnly /><span className="small">{language === "fr" ? "Utilise l'ajustement de stock ci-dessous pour modifier l'inventaire." : "Use the stock adjustment below to change inventory."}</span></div>)}
            <div className="field"><label>{language === "fr" ? "Statut" : "Status"}</label><label className="row"><input checked={productForm.isActive} onChange={(e) => setProductForm((current) => ({ ...current, isActive: e.target.checked }))} type="checkbox" /><span>{language === "fr" ? "Produit actif" : "Active product"}</span></label></div>
            <div className="field"><label>{language === "fr" ? "Abonnement récurrent" : "Recurring subscription"}</label><label className="row"><input checked={productForm.isSubscription} onChange={(e) => setProductForm((current) => ({ ...current, isSubscription: e.target.checked }))} type="checkbox" /><span>{language === "fr" ? "Ce produit est un abonnement" : "This product is a subscription"}</span></label></div>
            {productForm.isSubscription && (<><div className="field"><label>{language === "fr" ? "Prix par semaine (cents)" : "Weekly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceWeekly} onChange={(e) => setProductForm((current) => ({ ...current, priceWeekly: e.target.value }))} placeholder="3299 pour 32,99$" /></div><div className="field"><label>{language === "fr" ? "Prix toutes les 2 semaines (cents)" : "Bi-weekly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceBiweekly} onChange={(e) => setProductForm((current) => ({ ...current, priceBiweekly: e.target.value }))} placeholder="2999 pour 29,99$" /></div><div className="field"><label>{language === "fr" ? "Prix par mois (cents)" : "Monthly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceMonthly} onChange={(e) => setProductForm((current) => ({ ...current, priceMonthly: e.target.value }))} placeholder="2799 pour 27,99$" /></div><div className="field"><label>{language === "fr" ? "Prix par trimestre (cents)" : "Quarterly price (cents)"}</label><input className="input" type="number" min={0} value={productForm.priceQuarterly} onChange={(e) => setProductForm((current) => ({ ...current, priceQuarterly: e.target.value }))} placeholder="7999 pour 79,99$" /></div></>)}
          </div>

          <div className="row" style={{ marginTop: 12 }}><button className="btn" disabled={productFormLoading} type="submit">{productFormLoading ? "..." : productForm.id ? language === "fr" ? "Enregistrer les changements" : "Save changes" : language === "fr" ? "Créer le produit" : "Create product"}</button><button className="btn btn-secondary" onClick={() => { resetProductForm(); setProductFormError(""); setProductFormMessage(""); }} type="button">{language === "fr" ? "Réinitialiser" : "Reset"}</button></div>
        </form>

        <ImageSelector isOpen={imageSelectorOpen} onClose={() => setImageSelectorOpen(false)} onSelect={(url) => setProductForm((current) => ({ ...current, imageUrl: url }))} language={language} />
      </section>

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
                <th>Slug</th>
                <th>{language === "fr" ? "Catégorie" : "Category"}</th>
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
                      <strong>{language === "fr" ? product.nameFr : product.nameEn}</strong>
                      <div className="small">{language === "fr" ? product.nameEn : product.nameFr}</div>
                      {hasOrderHistory ? (
                        <div className="small" style={{ marginTop: 6 }}>
                          {language === "fr"
                            ? `Historique: ${product.orderHistoryCount} commande(s)`
                            : `History: ${product.orderHistoryCount} order(s)`}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Slug">{product.slug}</td>
                    <td data-label={language === "fr" ? "Catégorie" : "Category"}>{product.category}</td>
                    <td data-label={language === "fr" ? "Prix" : "Price"}>{formatMoney(product.priceCents, product.currency)}</td>
                    <td className="admin-product-stock-cell" data-label={language === "fr" ? "Stock" : "Stock"}>
                      <strong>{product.stock}</strong>
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
        <div className="table-wrap admin-inventory-table-wrap"><table className="admin-inventory-table"><thead><tr><th>{language === "fr" ? "Produit" : "Product"}</th><th>{language === "fr" ? "Variation" : "Change"}</th><th>{language === "fr" ? "Raison" : "Reason"}</th><th>{language === "fr" ? "Commande" : "Order"}</th><th>{language === "fr" ? "Date" : "Date"}</th></tr></thead><tbody>{inventoryItems.map((movement) => (<tr key={movement.id}><td data-label={language === "fr" ? "Produit" : "Product"}>{movement.productName}</td><td data-label={language === "fr" ? "Variation" : "Change"} className={movement.quantityChange >= 0 ? "ok" : "err"}>{movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}</td><td data-label={language === "fr" ? "Raison" : "Reason"}>{movement.reason}</td><td data-label={language === "fr" ? "Commande" : "Order"}>{movement.orderNumber ?? "-"}</td><td data-label={language === "fr" ? "Date" : "Date"}>{formatDateTime(movement.createdAt)}</td></tr>))}</tbody></table></div>
      </section>
    </>
  );
}




