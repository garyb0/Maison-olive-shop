"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import { Navigation } from "@/components/Navigation";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";
import { ImageSelector } from "@/components/ImageSelector";

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
};

type Props = {
  language: Language;
  t: Dictionary;
  oliveMode: "princess" | "gremlin";
  products: ProductRow[];
  inventoryMovements: InventoryMovementRow[];
  orders: Array<{
    id: string;
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalLabel: string;
    createdAtLabel: string;
  }>;
  customers: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    ordersCount: number;
    createdAtLabel: string;
  }>;
  taxSummary: {
    subtotalLabel: string;
    taxesLabel: string;
    shippingLabel: string;
    totalLabel: string;
  };
};

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
};

const sortProducts = (items: ProductRow[]) =>
  [...items].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

export function AdminClient({ language, t, oliveMode, products, inventoryMovements, orders, customers, taxSummary }: Props) {
  const adminNavUser = { role: "ADMIN" as const };
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  const [customerSearch, setCustomerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);
  const [currentOliveMode, setCurrentOliveMode] = useState<"princess" | "gremlin">(oliveMode);
  const [oliveModeLoading, setOliveModeLoading] = useState(false);
  const [oliveModeMessage, setOliveModeMessage] = useState("");
  const [oliveModeError, setOliveModeError] = useState("");
  const [productItems, setProductItems] = useState<ProductRow[]>(sortProducts(products));
  const [inventoryItems, setInventoryItems] = useState<InventoryMovementRow[]>(inventoryMovements);
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

  const locale = language === "fr" ? "fr-CA" : "en-CA";

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

  const toProductRow = (product: Record<string, unknown>): ProductRow => ({
    id: String(product.id),
    slug: String(product.slug),
    category: String(product.category ?? "General"),
    nameFr: String(product.nameFr),
    nameEn: String(product.nameEn),
    descriptionFr: String(product.descriptionFr),
    descriptionEn: String(product.descriptionEn),
    imageUrl: (product.imageUrl as string | null | undefined) ?? null,
    priceCents: Number(product.priceCents),
    currency: String(product.currency ?? "CAD"),
    stock: Number(product.stock),
    isActive: Boolean(product.isActive),
    createdAt: typeof product.createdAt === "string" ? product.createdAt : new Date(String(product.createdAt)).toISOString(),
  });

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
      createdAt:
        typeof movement.createdAt === "string"
          ? movement.createdAt
          : new Date(String(movement.createdAt)).toISOString(),
    };
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
    });
    setProductFormMessage("");
    setProductFormError("");
  };

  const saveProductToState = (product: ProductRow) => {
    setProductItems((current) => sortProducts([product, ...current.filter((item) => item.id !== product.id)]));
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusOk = !statusFilter || order.status === statusFilter;
      const paymentOk = !paymentFilter || order.paymentStatus === paymentFilter;
      const customerOk =
        !customerFilter ||
        order.customerEmail.toLowerCase().includes(customerFilter.toLowerCase()) ||
        order.customerName.toLowerCase().includes(customerFilter.toLowerCase());

      return statusOk && paymentOk && customerOk;
    });
  }, [orders, statusFilter, paymentFilter, customerFilter]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderTotalPages);
  const pagedOrders = filteredOrders.slice((safeOrderPage - 1) * orderPageSize, safeOrderPage * orderPageSize);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchOk =
        !customerSearch ||
        customer.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.fullName.toLowerCase().includes(customerSearch.toLowerCase());

      const roleOk = !roleFilter || customer.role === roleFilter;
      return searchOk && roleOk;
    });
  }, [customers, customerSearch, roleFilter]);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const pagedCustomers = filteredCustomers.slice((safeCustomerPage - 1) * customerPageSize, safeCustomerPage * customerPageSize);

  const clearOrderFilters = () => {
    setStatusFilter("");
    setPaymentFilter("");
    setCustomerFilter("");
    setOrderPage(1);
  };

  const clearCustomerFilters = () => {
    setCustomerSearch("");
    setRoleFilter("");
    setCustomerPage(1);
  };

  const submitProductForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductFormLoading(true);
    setProductFormMessage("");
    setProductFormError("");

    const payload = {
      ...(productForm.id ? { id: productForm.id } : {}),
      slug: productForm.slug.trim(),
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
          data.error ??
            (language === "fr" ? "Impossible d'enregistrer le produit." : "Unable to save product."),
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

    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, isActive: !product.isActive }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string; product?: Record<string, unknown> };

    if (!res.ok || !data.product) {
      setProductFormError(
        data.error ??
          (language === "fr" ? "Impossible de modifier le statut du produit." : "Unable to update product status."),
      );
      return;
    }

    saveProductToState(toProductRow(data.product));
    setProductFormMessage(
      !product.isActive
        ? language === "fr"
          ? "Produit réactivé."
          : "Product reactivated."
        : language === "fr"
          ? "Produit désactivé."
          : "Product deactivated.",
    );
  };

  const submitStockAdjustment = async (productId: string) => {
    const rawQuantity = stockAdjustments[productId] ?? "";
    const quantityChange = Number(rawQuantity);

    setStockMessage("");
    setStockError("");

    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      setStockError(
        language === "fr"
          ? "Entre un ajustement de stock valide (ex: 5 ou -2)."
          : "Enter a valid stock adjustment (e.g. 5 or -2).",
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
        setStockError(
          data.error ??
            (language === "fr" ? "Impossible d'ajuster le stock." : "Unable to adjust stock."),
        );
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
    const confirmed = window.confirm(
      language === "fr"
        ? `Supprimer définitivement le produit "${product.nameFr}" ?\n\nCette action efface aussi ses mouvements d'inventaire si aucune commande n'y est liée.`
        : `Permanently delete product "${product.nameEn}"?\n\nThis also removes its inventory movements if it is not linked to any order.`,
    );

    if (!confirmed) return;

    setDeleteLoadingId(product.id);
    setProductFormMessage("");
    setProductFormError("");

    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setProductFormError(
          data.error ??
            (language === "fr"
              ? "Impossible de supprimer le produit."
              : "Unable to delete product."),
        );
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
      if (productForm.id === product.id) {
        resetProductForm();
      }

      setProductFormMessage(
        language === "fr" ? "Produit supprimé définitivement." : "Product permanently deleted.",
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const updateOliveMode = async (mode: "princess" | "gremlin") => {
    setOliveModeLoading(true);
    setOliveModeMessage("");
    setOliveModeError("");

    try {
      const res = await fetch("/api/admin/olive-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!res.ok) {
        setOliveModeError(
          language === "fr"
            ? "Impossible de changer le mode d'Olive."
            : "Unable to change Olive mode.",
        );
        return;
      }

      setCurrentOliveMode(mode);
      setOliveModeMessage(
        language === "fr"
          ? mode === "gremlin"
            ? "Mode méchant d'Olive activé 👹"
            : "Mode princesse d'Olive activé 👑"
          : mode === "gremlin"
            ? "Olive gremlin mode activated 👹"
            : "Olive princess mode activated 👑",
      );
    } finally {
      setOliveModeLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={adminNavUser} />
      </header>

      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr"
            ? "Panneau admin pour surveiller les commandes, clients et taxes."
            : "Admin panel to monitor orders, customers and taxes."}
        </p>
      </section>

      <AdminSupportPanel language={language} />

      <section className="section">
        <h2>{language === "fr" ? "Mode Olive" : "Olive mode"}</h2>
        <p className="small">
          {language === "fr"
            ? `Mode actuel : ${currentOliveMode === "gremlin" ? "Méchant / Gremlin" : "Princess"}`
            : `Current mode: ${currentOliveMode === "gremlin" ? "Gremlin" : "Princess"}`}
        </p>
        {oliveModeMessage ? <p className="ok small">{oliveModeMessage}</p> : null}
        {oliveModeError ? <p className="err small">{oliveModeError}</p> : null}
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={currentOliveMode === "princess" ? "btn" : "btn btn-secondary"}
            disabled={oliveModeLoading}
            onClick={() => void updateOliveMode("princess")}
            type="button"
          >
            {language === "fr" ? "Activer Princess 👑" : "Activate Princess 👑"}
          </button>
          <button
            className={currentOliveMode === "gremlin" ? "btn" : "btn btn-secondary"}
            disabled={oliveModeLoading}
            onClick={() => void updateOliveMode("gremlin")}
            type="button"
          >
            {language === "fr" ? "Activer Méchant / Gremlin 👹" : "Activate Gremlin 👹"}
          </button>
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          {language === "fr"
            ? "Le choix est sauvegardé dans le fichier .env. Recharge l'accueil pour voir le changement."
            : "The choice is saved to the .env file. Refresh the storefront to see the change."}
        </p>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Produits & inventaire" : "Products & inventory"}</h2>
        <p className="small">
          {language === "fr"
            ? "Ajoute, modifie, désactive les produits et ajuste le stock sans toucher à la base manuellement."
            : "Add, edit, deactivate products and adjust stock without touching the database manually."}
        </p>

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
            <div className="field">
              <label>Slug</label>
              <input
                className="input"
                value={productForm.slug}
                onChange={(e) => setProductForm((current) => ({ ...current, slug: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Catégorie" : "Category"}</label>
              <input
                className="input"
                list="product-category-suggestions"
                value={productForm.category}
                onChange={(e) => setProductForm((current) => ({ ...current, category: e.target.value }))}
                required
              />
              <datalist id="product-category-suggestions">
                {Array.from(new Set(productItems.map((product) => product.category))).map((category) => (
                  <option key={category} value={category} />
                ))}
                <option value="Food" />
                <option value="Toys" />
                <option value="Accessories" />
                <option value="Hygiene" />
                <option value="Beds" />
              </datalist>
            </div>
            <div className="field">
              <label>{language === "fr" ? "URL image (optionnel)" : "Image URL (optional)"}</label>
              <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                <input
                  className="input"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm((current) => ({ ...current, imageUrl: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => setImageSelectorOpen(true)}
                  type="button"
                  style={{ whiteSpace: "nowrap" }}
                >
                  {language === "fr" ? "📁 Choisir" : "📁 Browse"}
                </button>
              </div>
              {productForm.imageUrl && (
                <div style={{ marginTop: 8 }}>
                  <Image
                    src={productForm.imageUrl}
                    alt="Apercu"
                    width={120}
                    height={80}
                    style={{
                      maxWidth: "120px",
                      maxHeight: "80px",
                      objectFit: "contain",
                      borderRadius: "4px",
                      border: "1px solid #e5e7eb",
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
            <div className="field">
              <label>{language === "fr" ? "Nom FR" : "French name"}</label>
              <input
                className="input"
                value={productForm.nameFr}
                onChange={(e) => setProductForm((current) => ({ ...current, nameFr: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Nom EN" : "English name"}</label>
              <input
                className="input"
                value={productForm.nameEn}
                onChange={(e) => setProductForm((current) => ({ ...current, nameEn: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Description FR" : "French description"}</label>
              <textarea
                className="textarea"
                value={productForm.descriptionFr}
                onChange={(e) => setProductForm((current) => ({ ...current, descriptionFr: e.target.value }))}
                rows={4}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Description EN" : "English description"}</label>
              <textarea
                className="textarea"
                value={productForm.descriptionEn}
                onChange={(e) => setProductForm((current) => ({ ...current, descriptionEn: e.target.value }))}
                rows={4}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Prix (cents)" : "Price (cents)"}</label>
              <input
                className="input"
                type="number"
                min={0}
                value={productForm.priceCents}
                onChange={(e) => setProductForm((current) => ({ ...current, priceCents: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Devise" : "Currency"}</label>
              <input
                className="input"
                value={productForm.currency}
                onChange={(e) => setProductForm((current) => ({ ...current, currency: e.target.value }))}
              />
            </div>
            {!productForm.id ? (
              <div className="field">
                <label>{language === "fr" ? "Stock initial" : "Initial stock"}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={productForm.stock}
                  onChange={(e) => setProductForm((current) => ({ ...current, stock: e.target.value }))}
                  required
                />
              </div>
            ) : (
              <div className="field">
                <label>{language === "fr" ? "Stock actuel" : "Current stock"}</label>
                <input className="input" value={productForm.stock} readOnly />
                <span className="small">
                  {language === "fr"
                    ? "Utilise l’ajustement de stock ci-dessous pour modifier l’inventaire."
                    : "Use the stock adjustment below to change inventory."}
                </span>
              </div>
            )}
            <div className="field">
              <label>{language === "fr" ? "Statut" : "Status"}</label>
              <label className="row">
                <input
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm((current) => ({ ...current, isActive: e.target.checked }))}
                  type="checkbox"
                />
                <span>{language === "fr" ? "Produit actif" : "Active product"}</span>
              </label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={productFormLoading} type="submit">
              {productFormLoading
                ? "..."
                : productForm.id
                  ? language === "fr"
                    ? "Enregistrer les changements"
                    : "Save changes"
                  : language === "fr"
                    ? "Créer le produit"
                    : "Create product"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                resetProductForm();
                setProductFormError("");
                setProductFormMessage("");
              }}
              type="button"
            >
              {language === "fr" ? "Réinitialiser" : "Reset"}
            </button>
          </div>
        </form>

        <ImageSelector
          isOpen={imageSelectorOpen}
          onClose={() => setImageSelectorOpen(false)}
          onSelect={(url) => setProductForm((current) => ({ ...current, imageUrl: url }))}
          language={language}
        />

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
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
              {productItems.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{language === "fr" ? product.nameFr : product.nameEn}</strong>
                    <div className="small">{language === "fr" ? product.nameEn : product.nameFr}</div>
                  </td>
                  <td>{product.slug}</td>
                  <td>{product.category}</td>
                  <td>{formatMoney(product.priceCents, product.currency)}</td>
                  <td>
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
                        onChange={(e) => setStockReasons((current) => ({ ...current, [product.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-secondary"
                        disabled={stockLoadingId === product.id}
                        onClick={() => void submitStockAdjustment(product.id)}
                        type="button"
                      >
                        {stockLoadingId === product.id
                          ? "..."
                          : language === "fr"
                            ? "Ajuster"
                            : "Adjust"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{product.isActive ? "ACTIVE" : "INACTIVE"}</span>
                  </td>
                  <td>{formatDateTime(product.createdAt)}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-secondary" onClick={() => startEditingProduct(product)} type="button">
                        {language === "fr" ? "Modifier" : "Edit"}
                      </button>
                      <button className="btn" onClick={() => void toggleProductActive(product)} type="button">
                        {product.isActive
                          ? language === "fr"
                            ? "Désactiver"
                            : "Deactivate"
                          : language === "fr"
                            ? "Réactiver"
                            : "Reactivate"}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={deleteLoadingId === product.id}
                        onClick={() => void deleteProduct(product)}
                        type="button"
                      >
                        {deleteLoadingId === product.id
                          ? "..."
                          : language === "fr"
                            ? "Supprimer"
                            : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Historique inventaire" : "Inventory history"}</h2>
        <p className="small">
          {language === "fr"
            ? "Mouvements récents du stock. Les commandes diminuent automatiquement l’inventaire."
            : "Recent stock movements. Orders automatically decrease inventory."}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Produit" : "Product"}</th>
                <th>{language === "fr" ? "Variation" : "Change"}</th>
                <th>{language === "fr" ? "Raison" : "Reason"}</th>
                <th>{language === "fr" ? "Commande" : "Order"}</th>
                <th>{language === "fr" ? "Date" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.productName}</td>
                  <td className={movement.quantityChange >= 0 ? "ok" : "err"}>
                    {movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}
                  </td>
                  <td>{movement.reason}</td>
                  <td>{movement.orderNumber ?? "—"}</td>
                  <td>{formatDateTime(movement.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{t.taxReport}</h2>
        <div className="row" style={{ gap: 16 }}>
          <span className="badge">
            {language === "fr" ? "Sous-total" : "Subtotal"}: {taxSummary.subtotalLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Taxes" : "Taxes"}: {taxSummary.taxesLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Livraison" : "Shipping"}: {taxSummary.shippingLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Total" : "Total"}: {taxSummary.totalLabel}
          </span>
          <a className="btn" href="/api/admin/taxes?format=csv">
            {t.taxesExportCsv}
          </a>
        </div>
      </section>

      <section className="section">
        <h2>{t.orders}</h2>

        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Filtre client/email" : "Filter customer/email"}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 240 }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous les statuts" : "All statuses"}</option>
            {Array.from(new Set(orders.map((o) => o.status))).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous paiements" : "All payments"}</option>
            {Array.from(new Set(orders.map((o) => o.paymentStatus))).map((ps) => (
              <option key={ps} value={ps}>
                {ps}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(orderPageSize)}
            onChange={(e) => {
              setOrderPageSize(Number(e.target.value));
              setOrderPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>

          <button className="btn" onClick={clearOrderFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={safeOrderPage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeOrderPage}/{orderTotalPages} · {filteredOrders.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
            disabled={safeOrderPage >= orderTotalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Commande" : "Order"}</th>
                <th>{language === "fr" ? "Client" : "Customer"}</th>
                <th>Email</th>
                <th>{language === "fr" ? "Date" : "Date"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Paiement" : "Payment"}</th>
                <th>{language === "fr" ? "Total" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.customerEmail}</td>
                  <td>{order.createdAtLabel}</td>
                  <td>{order.status}</td>
                  <td>{order.paymentStatus}</td>
                  <td>{order.totalLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{t.customers}</h2>

        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Recherche nom/email" : "Search name/email"}
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 240 }}
          />

          <select
            className="select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="">{language === "fr" ? "Tous rôles" : "All roles"}</option>
            {Array.from(new Set(customers.map((c) => c.role))).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(customerPageSize)}
            onChange={(e) => {
              setCustomerPageSize(Number(e.target.value));
              setCustomerPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>

          <button className="btn" onClick={clearCustomerFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setCustomerPage((p) => Math.max(1, p - 1))} disabled={safeCustomerPage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeCustomerPage}/{customerTotalPages} · {filteredCustomers.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
            disabled={safeCustomerPage >= customerTotalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Nom" : "Name"}</th>
                <th>Email</th>
                <th>{language === "fr" ? "Rôle" : "Role"}</th>
                <th>{language === "fr" ? "Nb commandes" : "Orders"}</th>
                <th>{language === "fr" ? "Créé" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.fullName}</td>
                  <td>{customer.email}</td>
                  <td>{customer.role}</td>
                  <td>{customer.ordersCount}</td>
                  <td>{customer.createdAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


