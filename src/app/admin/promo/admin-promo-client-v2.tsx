"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { hasMissingEnglishPromoCopy } from "@/lib/promo-banners";
import { PROMO_CTA_LINK_HELP_TEXT } from "@/lib/promo-links";

type PromoBannerRow = {
  id: string;
  isActive: boolean;
  sortOrder: number;
  badgeFr: string;
  badgeEn: string;
  titleFr: string;
  titleEn: string;
  price1Fr: string;
  price1En: string;
  price2Fr: string;
  price2En: string;
  point1Fr: string;
  point1En: string;
  point2Fr: string;
  point2En: string;
  point3Fr: string;
  point3En: string;
  ctaTextFr: string;
  ctaTextEn: string;
  ctaLink: string;
  createdAt: string;
};

type PromoFormState = {
  id: string | null;
  isActive: boolean;
  sortOrder: string;
  badgeFr: string;
  badgeEn: string;
  titleFr: string;
  titleEn: string;
  price1Fr: string;
  price1En: string;
  price2Fr: string;
  price2En: string;
  point1Fr: string;
  point1En: string;
  point2Fr: string;
  point2En: string;
  point3Fr: string;
  point3En: string;
  ctaTextFr: string;
  ctaTextEn: string;
  ctaLink: string;
};

type Props = {
  language: Language;
  banners: PromoBannerRow[];
  freeShippingThresholdLabel: string;
};

const emptyForm: PromoFormState = {
  id: null,
  isActive: true,
  sortOrder: "0",
  badgeFr: "🔥 Offre limitée",
  badgeEn: "",
  titleFr: "",
  titleEn: "",
  price1Fr: "1 pour 64,99 $",
  price1En: "",
  price2Fr: "🔥 2 pour seulement 100 $",
  price2En: "",
  point1Fr: "Ultra doux",
  point1En: "",
  point2Fr: "Lavable",
  point2En: "",
  point3Fr: "Approuvé par Olive",
  point3En: "",
  ctaTextFr: "Magasiner →",
  ctaTextEn: "",
  ctaLink: "/",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "1.05rem",
} as const;

const bilingualGridStyle = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  marginTop: 18,
} as const;

const formSectionStyle = {
  border: "1px solid var(--border)",
  borderRadius: "1rem",
  padding: "1rem",
  background: "rgba(255,255,255,0.72)",
} as const;

function copyFrenchValuesToEnglish(form: PromoFormState): PromoFormState {
  return {
    ...form,
    badgeEn: form.badgeFr,
    titleEn: form.titleFr,
    price1En: form.price1Fr,
    price2En: form.price2Fr,
    point1En: form.point1Fr,
    point2En: form.point2Fr,
    point3En: form.point3Fr,
    ctaTextEn: form.ctaTextFr,
  };
}

export function AdminPromoClient({ language, banners: initialBanners, freeShippingThresholdLabel }: Props) {
  const [banners, setBanners] = useState<PromoBannerRow[]>([...initialBanners].sort((a, b) => a.sortOrder - b.sortOrder));
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
    const nextForm = copyFrenchValuesToEnglish({
      ...emptyForm,
      sortOrder: String((banners.at(-1)?.sortOrder ?? 0) + 10),
      badgeFr: "Livraison locale",
      titleFr: `Livraison gratuite dès ${freeShippingThresholdLabel}`,
      price1Fr: "Rimouski et environs",
      price2Fr: "Commande simple, locale et rapide",
      point1Fr: "À domicile",
      point2Fr: "Seuil visible au panier",
      point3Fr: "Support Chez Olive",
      ctaTextFr: "Magasiner →",
    });

    setForm({
      ...nextForm,
      badgeEn: "Local delivery",
      titleEn: `Free delivery from ${freeShippingThresholdLabel}`,
      price1En: "Rimouski area and nearby",
      price2En: "Simple, local, fast ordering",
      point1En: "At your door",
      point2En: "Threshold shown in cart",
      point3En: "Chez Olive support",
      ctaTextEn: "Shop now →",
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
      badgeFr: banner.badgeFr,
      badgeEn: banner.badgeEn,
      titleFr: banner.titleFr,
      titleEn: banner.titleEn,
      price1Fr: banner.price1Fr,
      price1En: banner.price1En,
      price2Fr: banner.price2Fr,
      price2En: banner.price2En,
      point1Fr: banner.point1Fr,
      point1En: banner.point1En,
      point2Fr: banner.point2Fr,
      point2En: banner.point2En,
      point3Fr: banner.point3Fr,
      point3En: banner.point3En,
      ctaTextFr: banner.ctaTextFr,
      ctaTextEn: banner.ctaTextEn,
      ctaLink: banner.ctaLink,
    });
    setFormMessage("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveBannerToState = (banner: PromoBannerRow) => {
    setBanners((current) => [...current.filter((item) => item.id !== banner.id), banner].sort((a, b) => a.sortOrder - b.sortOrder));
  };

  const updateField = <K extends keyof PromoFormState>(field: K, value: PromoFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormLoading(true);
    setFormMessage("");
    setFormError("");

    const payload = {
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
      badgeFr: form.badgeFr.trim(),
      badgeEn: form.badgeEn.trim(),
      titleFr: form.titleFr.trim(),
      titleEn: form.titleEn.trim(),
      price1Fr: form.price1Fr.trim(),
      price1En: form.price1En.trim(),
      price2Fr: form.price2Fr.trim(),
      price2En: form.price2En.trim(),
      point1Fr: form.point1Fr.trim(),
      point1En: form.point1En.trim(),
      point2Fr: form.point2Fr.trim(),
      point2En: form.point2En.trim(),
      point3Fr: form.point3Fr.trim(),
      point3En: form.point3En.trim(),
      ctaTextFr: form.ctaTextFr.trim(),
      ctaTextEn: form.ctaTextEn.trim(),
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
        banner?: PromoBannerRow;
      };

      if (!res.ok || !data.banner) {
        setFormError(data.error ?? (language === "fr" ? "Impossible d'enregistrer la bannière." : "Unable to save banner."));
        return;
      }

      saveBannerToState({
        ...data.banner,
        createdAt: String(data.banner.createdAt),
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
      banner?: PromoBannerRow;
    };

    if (!res.ok || !data.banner) {
      setFormError(data.error ?? (language === "fr" ? "Impossible de modifier le statut." : "Unable to update status."));
      return;
    }

    saveBannerToState({
      ...data.banner,
      createdAt: String(data.banner.createdAt),
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
      language === "fr" ? `Supprimer la bannière "${banner.titleFr}" ?` : `Delete banner "${banner.titleEn || banner.titleFr}"?`,
    );

    if (!confirmed) return;

    setDeleteLoadingId(banner.id);
    setFormMessage("");
    setFormError("");

    try {
      const res = await fetch(`/api/admin/promo/${banner.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setFormError(data.error ?? (language === "fr" ? "Impossible de supprimer la bannière." : "Unable to delete banner."));
        return;
      }

      setBanners((current) => current.filter((item) => item.id !== banner.id));
      if (form.id === banner.id) {
        resetForm();
      }
      setFormMessage(language === "fr" ? "Bannière supprimée." : "Banner deleted.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const renderLocaleSection = (
    locale: "fr" | "en",
    title: string,
    description: string,
    requiredTitle: boolean,
  ) => {
    const suffix = locale === "fr" ? "Fr" : "En";

    return (
      <div style={formSectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <h3 style={sectionTitleStyle}>{title}</h3>
            <p className="small" style={{ margin: "4px 0 0" }}>{description}</p>
          </div>
          {locale === "en" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setForm((current) => copyFrenchValuesToEnglish(current))}
            >
              {language === "fr" ? "Copier FR vers EN" : "Copy FR to EN"}
            </button>
          ) : null}
        </div>

        <div className="two-col">
          <div className="field">
            <label>{locale === "fr" ? "Titre" : "Title"}</label>
            <input
              className="input"
              value={form[`title${suffix}` as const]}
              onChange={(event) => updateField(`title${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Confort premium pour ton chien" : "Premium comfort for your dog"}
              required={requiredTitle}
            />
          </div>
          <div className="field">
            <label>Badge</label>
            <input
              className="input"
              value={form[`badge${suffix}` as const]}
              onChange={(event) => updateField(`badge${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Offre limitée" : "Limited offer"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Prix 1" : "Price 1"}</label>
            <input
              className="input"
              value={form[`price1${suffix}` as const]}
              onChange={(event) => updateField(`price1${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "1 pour 64,99 $" : "1 for $64.99"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Prix 2" : "Price 2"}</label>
            <input
              className="input"
              value={form[`price2${suffix}` as const]}
              onChange={(event) => updateField(`price2${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "2 pour seulement 100 $" : "2 for only $100"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Point 1" : "Point 1"}</label>
            <input
              className="input"
              value={form[`point1${suffix}` as const]}
              onChange={(event) => updateField(`point1${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Ultra doux" : "Ultra soft"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Point 2" : "Point 2"}</label>
            <input
              className="input"
              value={form[`point2${suffix}` as const]}
              onChange={(event) => updateField(`point2${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Lavable" : "Washable"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Point 3" : "Point 3"}</label>
            <input
              className="input"
              value={form[`point3${suffix}` as const]}
              onChange={(event) => updateField(`point3${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Approuvé par Olive" : "Olive approved"}
            />
          </div>
          <div className="field">
            <label>{locale === "fr" ? "Texte du bouton" : "Button text"}</label>
            <input
              className="input"
              value={form[`ctaText${suffix}` as const]}
              onChange={(event) => updateField(`ctaText${suffix}` as keyof PromoFormState, event.target.value)}
              placeholder={locale === "fr" ? "Magasiner →" : "Shop now →"}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Bannières promotionnelles" : "Promotional banners"}</h1>
        <p className="small">
          {language === "fr"
            ? "Gère les bannières qui défilent en haut du site avec une vraie version française et anglaise."
            : "Manage the banners shown at the top of the site with a true French and English version."}
        </p>
        <div className="row" style={{ gap: "0.75rem", marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={useFreeDeliveryTemplate}>
            {language === "fr" ? "Modèle livraison gratuite" : "Free delivery template"}
          </button>
          <span className="small">
            {language === "fr" ? `Seuil actuel : ${freeShippingThresholdLabel}` : `Current threshold: ${freeShippingThresholdLabel}`}
          </span>
        </div>
      </section>

      <section className="section">
        <h2>{form.id ? (language === "fr" ? "Modifier la bannière" : "Edit banner") : language === "fr" ? "Ajouter une bannière" : "Add banner"}</h2>
        <p className="small" style={{ marginTop: 6 }}>
          {language === "fr"
            ? "Le français reste la base. Tu peux ensuite copier vers l'anglais puis ajuster la traduction."
            : "French stays as the source. You can then copy to English and adjust the translation."}
        </p>
        {formMessage ? <p className="ok small">{formMessage}</p> : null}
        {formError ? <p className="err small">{formError}</p> : null}

        <form className="section" onSubmit={submitForm} style={{ marginTop: 16 }}>
          <div className="two-col">
            <div className="field">
              <label>{language === "fr" ? "Lien du bouton" : "Button link"}</label>
              <input className="input" value={form.ctaLink} onChange={(event) => updateField("ctaLink", event.target.value)} placeholder="/" />
              <span className="small">
                {language === "fr" ? PROMO_CTA_LINK_HELP_TEXT : "Valid examples: /, /checkout, /faq, /products/product-slug"}
              </span>
            </div>
            <div className="field">
              <label>{language === "fr" ? "Ordre" : "Order"}</label>
              <input className="input" type="number" value={form.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} />
              <span className="small">
                {language === "fr" ? "0 = premier, nombre plus grand = plus bas" : "0 = first, higher number = lower"}
              </span>
            </div>
            <div className="field">
              <label>{language === "fr" ? "Statut" : "Status"}</label>
              <label className="row">
                <input checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} type="checkbox" />
                <span>{language === "fr" ? "Bannière active" : "Active banner"}</span>
              </label>
            </div>
          </div>

          <div style={bilingualGridStyle}>
            {renderLocaleSection("fr", "Français", language === "fr" ? "Version principale de la bannière." : "Primary banner copy.", true)}
            {renderLocaleSection("en", "English", language === "fr" ? "Version affichée quand le client passe le site en anglais." : "Shown when the customer switches the site to English.", false)}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" disabled={formLoading} type="submit">
              {formLoading ? "..." : form.id ? (language === "fr" ? "Enregistrer" : "Save") : language === "fr" ? "Créer la bannière" : "Create banner"}
            </button>
            <button className="btn btn-secondary" onClick={resetForm} type="button">
              {language === "fr" ? "Réinitialiser" : "Reset"}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Bannières existantes" : "Existing banners"}</h2>
        <p className="small">
          {language === "fr"
            ? `Le carrousel défilera les ${banners.filter((banner) => banner.isActive).length} bannière(s) active(s) toutes les 25 secondes.`
            : `The carousel will rotate ${banners.filter((banner) => banner.isActive).length} active banner(s) every 25 seconds.`}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Ordre" : "Order"}</th>
                <th>{language === "fr" ? "Aperçu" : "Preview"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => {
                const missingEnglish = hasMissingEnglishPromoCopy(banner);

                return (
                  <tr key={banner.id}>
                    <td>{banner.sortOrder}</td>
                    <td>
                      <div style={{ display: "grid", gap: 10 }}>
                        <div>
                          <strong>FR:</strong> {banner.titleFr}
                          <div className="small">{banner.badgeFr || "-"}</div>
                          <div className="small">{banner.price1Fr} | {banner.price2Fr}</div>
                        </div>
                        <div>
                          <strong>EN:</strong> {banner.titleEn || <span className="small">-</span>}
                          <div className="small">{banner.badgeEn || "-"}</div>
                          <div className="small">{banner.price1En || "-"} | {banner.price2En || "-"}</div>
                        </div>
                        {missingEnglish ? (
                          <span className="badge badge--inactive">
                            {language === "fr" ? "ANGLAIS À COMPLÉTER" : "ENGLISH TO COMPLETE"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${banner.isActive ? "" : "badge--inactive"}`}>
                        {banner.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <div className="row">
                        <button className="btn btn-secondary" onClick={() => startEditing(banner)} type="button">
                          {language === "fr" ? "Modifier" : "Edit"}
                        </button>
                        <button className="btn" onClick={() => void toggleActive(banner)} type="button">
                          {banner.isActive ? (language === "fr" ? "Désactiver" : "Disable") : language === "fr" ? "Activer" : "Enable"}
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={deleteLoadingId === banner.id}
                          onClick={() => void deleteBanner(banner)}
                          type="button"
                        >
                          {deleteLoadingId === banner.id ? "..." : language === "fr" ? "Supprimer" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {banners.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="small">{language === "fr" ? "Aucune bannière. Crée-en une ci-dessus." : "No banners yet. Create one above."}</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
