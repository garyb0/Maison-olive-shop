"use client";

export { AdminPromoClient } from "./admin-promo-client-v2";

/*

import { useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import { PROMO_CTA_LINK_HELP_TEXT } from "@/lib/promo-links";

type PromoBannerRow = {
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
  createdAt: string;
};

type PromoFormState = {
  id: string | null;
  isActive: boolean;
  sortOrder: string;
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
  language: Language;
  t: Dictionary;
  banners: PromoBannerRow[];
  freeShippingThresholdLabel: string;
};

const emptyForm: PromoFormState = {
  id: null,
  isActive: true,
  sortOrder: "0",
  badge: "🔥 Offre limitée",
  title: "",
  price1: "1 pour 64,99 $",
  price2: "🔥 2 pour seulement 100 $",
  point1: "Ultra doux",
  point2: "Lavable",
  point3: "Approuvé par Olive",
  ctaText: "Magasiner →",
  ctaLink: "/",
};

function LegacyAdminPromoClient({ language, banners: initialBanners, freeShippingThresholdLabel }: Props) {
  const [banners, setBanners] = useState<PromoBannerRow[]>(
    [...initialBanners].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [form, setForm] = useState<PromoFormState>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyForm);
    setFormMessage("");
    setFormError("");
  };

  const useFreeDeliveryTemplate = () => {
    setForm({
      id: null,
      isActive: true,
      sortOrder: String((banners.at(-1)?.sortOrder ?? 0) + 10),
      badge: language === "fr" ? "Livraison locale" : "Local delivery",
      title:
        language === "fr"
          ? `Livraison gratuite des ${freeShippingThresholdLabel}`
          : `Free delivery from ${freeShippingThresholdLabel}`,
      price1: language === "fr" ? "Rimouski et environs" : "Rimouski area and nearby",
      price2: language === "fr" ? "Commande simple, locale et rapide" : "Simple, local, fast ordering",
      point1: language === "fr" ? "A domicile" : "At your door",
      point2: language === "fr" ? "Seuil visible au panier" : "Threshold shown in cart",
      point3: language === "fr" ? "Support Chez Olive" : "Chez Olive support",
      ctaText: language === "fr" ? "Magasiner →" : "Shop now →",
      ctaLink: "/",
    });
    setFormMessage("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditing = (banner: PromoBannerRow) => {
    setForm({
      id: banner.id,
      isActive: banner.isActive,
      sortOrder: String(banner.sortOrder),
      badge: banner.badge,
      title: banner.title,
      price1: banner.price1,
      price2: banner.price2,
      point1: banner.point1,
      point2: banner.point2,
      point3: banner.point3,
      ctaText: banner.ctaText,
      ctaLink: banner.ctaLink,
    });
    setFormMessage("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveBannerToState = (banner: PromoBannerRow) => {
    setBanners((current) =>
      [...current.filter((b) => b.id !== banner.id), banner].sort((a, b) => a.sortOrder - b.sortOrder),
    );
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormLoading(true);
    setFormMessage("");
    setFormError("");

    const payload = {
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
      badge: form.badge.trim(),
      title: form.title.trim(),
      price1: form.price1.trim(),
      price2: form.price2.trim(),
      point1: form.point1.trim(),
      point2: form.point2.trim(),
      point3: form.point3.trim(),
      ctaText: form.ctaText.trim(),
      ctaLink: form.ctaLink.trim(),
    };

    try {
      const url = form.id ? `/api/admin/promo/${form.id}` : "/api/admin/promo";
      const method = form.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        banner?: Record<string, unknown>;
      };

      if (!res.ok || !data.banner) {
        setFormError(
          data.error ??
            (language === "fr"
              ? "Impossible d'enregistrer la bannière."
              : "Unable to save banner."),
        );
        return;
      }

      const saved = data.banner;
      saveBannerToState({
        id: String(saved.id),
        isActive: Boolean(saved.isActive),
        sortOrder: Number(saved.sortOrder),
        badge: String(saved.badge),
        title: String(saved.title),
        price1: String(saved.price1),
        price2: String(saved.price2),
        point1: String(saved.point1),
        point2: String(saved.point2),
        point3: String(saved.point3),
        ctaText: String(saved.ctaText),
        ctaLink: String(saved.ctaLink),
        createdAt: String(saved.createdAt),
      });

      setFormMessage(
        form.id
          ? language === "fr"
            ? "Bannière mise à jour."
            : "Banner updated."
          : language === "fr"
            ? "Bannière créée."
            : "Banner created.",
      );
      resetForm();
    } finally {
      setFormLoading(false);
    }
  };

  const toggleActive = async (banner: PromoBannerRow) => {
    setFormMessage("");
    setFormError("");

    const res = await fetch(`/api/admin/promo/${banner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !banner.isActive }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      banner?: Record<string, unknown>;
    };

    if (!res.ok || !data.banner) {
      setFormError(
        data.error ??
          (language === "fr"
            ? "Impossible de modifier le statut."
            : "Unable to update status."),
      );
      return;
    }

    const saved = data.banner;
    saveBannerToState({
      id: String(saved.id),
      isActive: Boolean(saved.isActive),
      sortOrder: Number(saved.sortOrder),
      badge: String(saved.badge),
      title: String(saved.title),
      price1: String(saved.price1),
      price2: String(saved.price2),
      point1: String(saved.point1),
      point2: String(saved.point2),
      point3: String(saved.point3),
      ctaText: String(saved.ctaText),
      ctaLink: String(saved.ctaLink),
      createdAt: String(saved.createdAt),
    });

    setFormMessage(
      !banner.isActive
        ? language === "fr"
          ? "Bannière activée."
          : "Banner enabled."
        : language === "fr"
          ? "Bannière désactivée."
          : "Banner disabled.",
    );
  };

  const deleteBanner = async (banner: PromoBannerRow) => {
    const confirmed = window.confirm(
      language === "fr"
        ? `Supprimer la bannière "${banner.title}" ?`
        : `Delete banner "${banner.title}"?`,
    );

    if (!confirmed) return;

    setDeleteLoadingId(banner.id);
    setFormMessage("");
    setFormError("");

    try {
      const res = await fetch(`/api/admin/promo/${banner.id}`, {
        method: "DELETE",
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setFormError(
          data.error ??
            (language === "fr"
              ? "Impossible de supprimer la bannière."
              : "Unable to delete banner."),
        );
        return;
      }

      setBanners((current) => current.filter((b) => b.id !== banner.id));
      if (form.id === banner.id) {
        resetForm();
      }
      setFormMessage(
        language === "fr" ? "Bannière supprimée." : "Banner deleted.",
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <>
      <section className="section">
        <h1>
          {language === "fr" ? "Bannières promotionnelles" : "Promotional Banners"}
        </h1>
        <p className="small">
          {language === "fr"
            ? "Gère les bannières qui défilent en haut du site. Les clients verront les bannières actives en rotation automatique."
            : "Manage the banners that rotate at the top of the site. Customers will see active banners in automatic rotation."}
        </p>
        <div className="row" style={{ gap: "0.75rem", marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={useFreeDeliveryTemplate}>
            {language === "fr" ? "Modele livraison gratuite" : "Free delivery template"}
          </button>
          <span className="small">
            {language === "fr"
              ? `Seuil actuel : ${freeShippingThresholdLabel}`
              : `Current threshold: ${freeShippingThresholdLabel}`}
          </span>
        </div>
      </section>

      <section className="section">
        <h2>
          {form.id
            ? language === "fr"
              ? "Modifier la bannière"
              : "Edit banner"
            : language === "fr"
              ? "Ajouter une bannière"
              : "Add banner"}
        </h2>
        {formMessage ? <p className="ok small">{formMessage}</p> : null}
        {formError ? <p className="err small">{formError}</p> : null}

        <form className="section" onSubmit={submitForm} style={{ marginTop: 16 }}>
          <div className="two-col">
            <div className="field">
              <label>{language === "fr" ? "Titre" : "Title"}</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) =>
                  setForm((c) => ({ ...c, title: e.target.value }))
                }
                placeholder="🐾 Confort Premium pour ton chien"
                required
              />
            </div>
            <div className="field">
              <label>Badge</label>
              <input
                className="input"
                value={form.badge}
                onChange={(e) =>
                  setForm((c) => ({ ...c, badge: e.target.value }))
                }
                placeholder="🔥 Offre limitée"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Prix 1" : "Price 1"}</label>
              <input
                className="input"
                value={form.price1}
                onChange={(e) =>
                  setForm((c) => ({ ...c, price1: e.target.value }))
                }
                placeholder="1 pour 64,99 $"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Prix 2 (deal)" : "Price 2 (deal)"}</label>
              <input
                className="input"
                value={form.price2}
                onChange={(e) =>
                  setForm((c) => ({ ...c, price2: e.target.value }))
                }
                placeholder="🔥 2 pour seulement 100 $"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Point 1" : "Point 1"}</label>
              <input
                className="input"
                value={form.point1}
                onChange={(e) =>
                  setForm((c) => ({ ...c, point1: e.target.value }))
                }
                placeholder="Ultra doux"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Point 2" : "Point 2"}</label>
              <input
                className="input"
                value={form.point2}
                onChange={(e) =>
                  setForm((c) => ({ ...c, point2: e.target.value }))
                }
                placeholder="Lavable"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Point 3" : "Point 3"}</label>
              <input
                className="input"
                value={form.point3}
                onChange={(e) =>
                  setForm((c) => ({ ...c, point3: e.target.value }))
                }
                placeholder="Approuvé par Olive"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Texte bouton" : "Button text"}</label>
              <input
                className="input"
                value={form.ctaText}
                onChange={(e) =>
                  setForm((c) => ({ ...c, ctaText: e.target.value }))
                }
                placeholder="Magasiner →"
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Lien bouton" : "Button link"}</label>
              <input
                className="input"
                value={form.ctaLink}
                onChange={(e) =>
                  setForm((c) => ({ ...c, ctaLink: e.target.value }))
                }
                placeholder="/"
              />
              <span className="small">
                {language === "fr"
                  ? PROMO_CTA_LINK_HELP_TEXT
                  : "Valid examples: /, /checkout, /faq, /products/product-slug"}
              </span>
            </div>
            <div className="field">
              <label>{language === "fr" ? "Ordre" : "Order"}</label>
              <input
                className="input"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((c) => ({ ...c, sortOrder: e.target.value }))
                }
              />
              <span className="small">
                {language === "fr"
                  ? "0 = premier, nombre plus grand = plus bas"
                  : "0 = first, higher number = lower"}
              </span>
            </div>
            <div className="field">
              <label>{language === "fr" ? "Statut" : "Status"}</label>
              <label className="row">
                <input
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, isActive: e.target.checked }))
                  }
                  type="checkbox"
                />
                <span>
                  {language === "fr" ? "Bannière active" : "Active banner"}
                </span>
              </label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={formLoading} type="submit">
              {formLoading
                ? "..."
                : form.id
                  ? language === "fr"
                    ? "Enregistrer"
                    : "Save"
                  : language === "fr"
                    ? "Créer la bannière"
                    : "Create banner"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={resetForm}
              type="button"
            >
              {language === "fr" ? "Réinitialiser" : "Reset"}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>
          {language === "fr" ? "Bannières existantes" : "Existing banners"}
        </h2>
        <p className="small">
          {language === "fr"
            ? `Le carrousel défilera les ${banners.filter((b) => b.isActive).length} bannière(s) active(s) toutes les 25 secondes.`
            : `The carousel will rotate ${banners.filter((b) => b.isActive).length} active banner(s) every 25 seconds.`}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Ordre" : "Order"}</th>
                <th>{language === "fr" ? "Bannière" : "Banner"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id}>
                  <td>{banner.sortOrder}</td>
                  <td>
                    <strong>{banner.badge}</strong>
                    <div>{banner.title}</div>
                    <div className="small">
                      {banner.price1} | {banner.price2}
                    </div>
                    <div className="small">
                      ✔ {banner.point1} | ✔ {banner.point2} | ✔ {banner.point3}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${banner.isActive ? "" : "badge--inactive"}`}>
                      {banner.isActive
                        ? language === "fr"
                          ? "ACTIVE"
                          : "ACTIVE"
                        : language === "fr"
                          ? "INACTIVE"
                          : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button
                        className="btn btn-secondary"
                        onClick={() => startEditing(banner)}
                        type="button"
                      >
                        {language === "fr" ? "Modifier" : "Edit"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => void toggleActive(banner)}
                        type="button"
                      >
                        {banner.isActive
                          ? language === "fr"
                            ? "Désactiver"
                            : "Disable"
                          : language === "fr"
                            ? "Activer"
                            : "Enable"}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={deleteLoadingId === banner.id}
                        onClick={() => void deleteBanner(banner)}
                        type="button"
                      >
                        {deleteLoadingId === banner.id
                          ? "..."
                          : language === "fr"
                            ? "Supprimer"
                            : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <p className="small">
                      {language === "fr"
                        ? "Aucune bannière. Créez-en une ci-dessus."
                        : "No banners. Create one above."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
*/
