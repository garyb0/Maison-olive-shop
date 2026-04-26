"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";

type PromoCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number;
  isActive: boolean;
  isLaunchBlocked?: boolean;
  createdAt: string;
};

type PromoCodeFormState = {
  id: string | null;
  code: string;
  description: string;
  discountPercent: string;
  isActive: boolean;
};

type Props = {
  language: Language;
  promoCodes: PromoCodeRow[];
};

const emptyForm: PromoCodeFormState = {
  id: null,
  code: "",
  description: "",
  discountPercent: "10",
  isActive: true,
};

export function AdminPromoCodesClient({ language, promoCodes: initialPromoCodes }: Props) {
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>(initialPromoCodes);
  const [form, setForm] = useState<PromoCodeFormState>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyForm);
    setFormMessage("");
    setFormError("");
  };

  const savePromoCodeToState = (promoCode: PromoCodeRow) => {
    setPromoCodes((current) =>
      [...current.filter((item) => item.id !== promoCode.id), promoCode].sort((a, b) => a.code.localeCompare(b.code)),
    );
  };

  const startEditing = (promoCode: PromoCodeRow) => {
    setForm({
      id: promoCode.id,
      code: promoCode.code,
      description: promoCode.description ?? "",
      discountPercent: String(promoCode.discountPercent),
      isActive: promoCode.isActive,
    });
    setFormMessage("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormLoading(true);
    setFormMessage("");
    setFormError("");

    try {
      const res = await fetch(form.id ? `/api/admin/promo-codes/${form.id}` : "/api/admin/promo-codes", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          description: form.description.trim() || undefined,
          discountPercent: Number(form.discountPercent),
          isActive: form.isActive,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        promoCode?: Record<string, unknown>;
      };

      if (!res.ok || !data.promoCode) {
        setFormError(
          data.error ??
            (language === "fr" ? "Impossible d'enregistrer le code promo." : "Unable to save promo code."),
        );
        return;
      }

      const saved = data.promoCode;
      savePromoCodeToState({
        id: String(saved.id),
        code: String(saved.code),
        description: saved.description ? String(saved.description) : null,
        discountPercent: Number(saved.discountPercent),
        isActive: Boolean(saved.isActive),
        createdAt: String(saved.createdAt),
      });

      setFormMessage(
        form.id
          ? language === "fr"
            ? "Code promo mis à jour."
            : "Promo code updated."
          : language === "fr"
            ? "Code promo créé."
            : "Promo code created.",
      );
      resetForm();
    } finally {
      setFormLoading(false);
    }
  };

  const toggleActive = async (promoCode: PromoCodeRow) => {
    setFormMessage("");
    setFormError("");

    const res = await fetch(`/api/admin/promo-codes/${promoCode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promoCode.isActive }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      promoCode?: Record<string, unknown>;
    };

    if (!res.ok || !data.promoCode) {
      setFormError(
        data.error ??
          (language === "fr" ? "Impossible de modifier le statut." : "Unable to update status."),
      );
      return;
    }

    const saved = data.promoCode;
    savePromoCodeToState({
      id: String(saved.id),
      code: String(saved.code),
      description: saved.description ? String(saved.description) : null,
      discountPercent: Number(saved.discountPercent),
      isActive: Boolean(saved.isActive),
      createdAt: String(saved.createdAt),
    });
  };

  const deletePromoCode = async (promoCode: PromoCodeRow) => {
    const confirmed = window.confirm(
      language === "fr" ? `Supprimer le code promo "${promoCode.code}" ?` : `Delete promo code "${promoCode.code}"?`,
    );
    if (!confirmed) return;

    setDeleteLoadingId(promoCode.id);
    setFormMessage("");
    setFormError("");

    try {
      const res = await fetch(`/api/admin/promo-codes/${promoCode.id}`, {
        method: "DELETE",
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(
          data.error ??
            (language === "fr" ? "Impossible de supprimer le code promo." : "Unable to delete promo code."),
        );
        return;
      }

      setPromoCodes((current) => current.filter((item) => item.id !== promoCode.id));
      if (form.id === promoCode.id) {
        resetForm();
      }
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <>
      <section className="section">
        <h2>{language === "fr" ? "Codes promo checkout" : "Checkout promo codes"}</h2>
        <p className="small">
          {language === "fr"
            ? "Créé des codes que les clients peuvent entrer au checkout. Le rabais s'applique automatiquement sur le calcul."
            : "Create promo codes that customers can enter at checkout. The discount is applied automatically during pricing."}
        </p>
        {formMessage ? <p className="ok small">{formMessage}</p> : null}
        {formError ? <p className="err small">{formError}</p> : null}

        <form className="section" onSubmit={submitForm} style={{ marginTop: 16 }}>
          <div className="two-col">
            <div className="field">
              <label>{language === "fr" ? "Code" : "Code"}</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))}
                placeholder={language === "fr" ? "Ex. BIENVENUE10" : "e.g. WELCOME10"}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Rabais (%)" : "Discount (%)"}</label>
              <input
                className="input"
                type="number"
                min={1}
                max={100}
                value={form.discountPercent}
                onChange={(e) => setForm((current) => ({ ...current, discountPercent: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Description" : "Description"}</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                placeholder={language === "fr" ? "Ex. Rabais de bienvenue" : "e.g. Welcome discount"}
              />
            </div>
            <div className="field">
              <label>{language === "fr" ? "Statut" : "Status"}</label>
              <label className="row">
                <input
                  checked={form.isActive}
                  onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                  type="checkbox"
                />
                <span>{language === "fr" ? "Code actif" : "Active code"}</span>
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
                    ? "Créer le code"
                    : "Create code"}
            </button>
            <button className="btn btn-secondary" onClick={resetForm} type="button">
              {language === "fr" ? "Réinitialiser" : "Reset"}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Codes existants" : "Existing promo codes"}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Code" : "Code"}</th>
                <th>{language === "fr" ? "Details" : "Details"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((promoCode) => (
                <tr key={promoCode.id}>
                  <td><strong>{promoCode.code}</strong></td>
                  <td>
                    <div>{promoCode.discountPercent}%</div>
                    <div className="small">{promoCode.description ?? (language === "fr" ? "Sans description" : "No description")}</div>
                  </td>
                  <td>
                    <span className={`badge ${promoCode.isActive && !promoCode.isLaunchBlocked ? "" : "badge--inactive"}`}>
                      {promoCode.isLaunchBlocked
                        ? language === "fr"
                          ? "BLOQUÉ LANCEMENT"
                          : "LAUNCH BLOCKED"
                        : promoCode.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn btn-secondary" onClick={() => startEditing(promoCode)} type="button">
                        {language === "fr" ? "Modifier" : "Edit"}
                      </button>
                      <button className="btn" disabled={promoCode.isLaunchBlocked} onClick={() => void toggleActive(promoCode)} type="button">
                        {promoCode.isActive
                          ? language === "fr" ? "Désactiver" : "Disable"
                          : language === "fr" ? "Activer" : "Enable"}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={deleteLoadingId === promoCode.id}
                        onClick={() => void deletePromoCode(promoCode)}
                        type="button"
                      >
                        {deleteLoadingId === promoCode.id
                          ? "..."
                          : language === "fr"
                            ? "Supprimer"
                            : "Delete"}
                      </button>
                    </div>
                    {promoCode.isLaunchBlocked ? (
                      <p className="small" style={{ marginTop: 8 }}>
                        {language === "fr"
                          ? "Code neutralisé pour le lancement, même s'il existe encore en base."
                          : "Code neutralized for launch, even if it still exists in the database."}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
              {promoCodes.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="small">
                      {language === "fr" ? "Aucun code promo pour le moment." : "No promo codes yet."}
                    </p>
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
