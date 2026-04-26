"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { DogProfileAccount } from "@/lib/types";
import type { Language } from "@/lib/i18n";
import { DogPhotoUpload } from "@/components/DogPhotoUpload";

type Props = {
  language: Language;
  initialDogs: DogProfileAccount[];
};

type EditorTab = "profile" | "visibility";

type DogFormState = {
  name: string;
  photoUrl: string;
  ageLabel: string;
  ownerPhone: string;
  importantNotes: string;
  publicProfileEnabled: boolean;
  showPhotoPublic: boolean;
  showAgePublic: boolean;
  showPhonePublic: boolean;
  showNotesPublic: boolean;
  isActive: boolean;
};

const toFormState = (dog: DogProfileAccount): DogFormState => ({
  name: dog.name ?? "",
  photoUrl: dog.photoUrl ?? "",
  ageLabel: dog.ageLabel ?? "",
  ownerPhone: dog.ownerPhone ?? "",
  importantNotes: dog.importantNotes ?? "",
  publicProfileEnabled: dog.publicProfileEnabled,
  showPhotoPublic: dog.showPhotoPublic,
  showAgePublic: dog.showAgePublic,
  showPhonePublic: dog.showPhonePublic,
  showNotesPublic: dog.showNotesPublic,
  isActive: dog.isActive,
});

const emptyClaimState = (): DogFormState & { publicToken: string } => ({
  publicToken: "",
  name: "",
  photoUrl: "",
  ageLabel: "",
  ownerPhone: "",
  importantNotes: "",
  publicProfileEnabled: true,
  showPhotoPublic: false,
  showAgePublic: false,
  showPhonePublic: false,
  showNotesPublic: false,
  isActive: true,
});

function summarizeVisibility(
  form: Pick<
    DogFormState,
    "publicProfileEnabled" | "showPhotoPublic" | "showAgePublic" | "showPhonePublic" | "showNotesPublic"
  >,
  language: Language,
) {
  if (!form.publicProfileEnabled) {
    return language === "fr"
      ? "Fiche masquée : seul le nom restera visible via le QR."
      : "Profile hidden: only the dog's name will remain visible through the QR code.";
  }

  const visible: string[] = [];
  if (form.showPhotoPublic) visible.push(language === "fr" ? "la photo" : "photo");
  if (form.showAgePublic) visible.push(language === "fr" ? "l'âge ou le descriptif" : "age or short label");
  if (form.showPhonePublic) visible.push(language === "fr" ? "le bouton d'appel" : "the call button");
  if (form.showNotesPublic) visible.push(language === "fr" ? "les notes importantes" : "important notes");

  if (visible.length === 0) {
    return language === "fr"
      ? "Mode privé strict : le public ne verra que le nom du chien."
      : "Strict private mode: the public will only see the dog's name.";
  }

  return language === "fr"
    ? `Le public verra : ${visible.join(", ")}.`
    : `The public will see: ${visible.join(", ")}.`;
}

function ProfileSection({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        gridColumn: "1 / -1",
        border: "1px solid rgba(94, 119, 69, 0.14)",
        borderRadius: 26,
        padding: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250, 247, 240, 0.96) 100%)",
        boxShadow: "0 12px 30px rgba(80, 67, 36, 0.06)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <p className="account-home-hero__eyebrow" style={{ marginBottom: 8 }}>
          {eyebrow}
        </p>
        <h3 style={{ margin: 0, color: "#44321d" }}>{title}</h3>
        {hint ? (
          <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EditorTabs({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: EditorTab;
  onChange: (value: EditorTab) => void;
}) {
  const tabs: Array<{ id: EditorTab; label: string; hint: string }> = [
    {
      id: "profile",
      label: language === "fr" ? "Profil" : "Profile",
      hint: language === "fr" ? "Identité, contact et sécurité" : "Identity, contact and safety",
    },
    {
      id: "visibility",
      label: language === "fr" ? "Visibilité publique" : "Public visibility",
      hint: language === "fr" ? "Ce que les gens voient" : "What people can see",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 10,
        marginBottom: 18,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            className="btn btn-secondary"
            onClick={() => onChange(tab.id)}
            style={{
              justifyContent: "flex-start",
              padding: "14px 16px",
              borderRadius: 20,
              border: active ? "1px solid rgba(94, 119, 69, 0.38)" : "1px solid rgba(94, 119, 69, 0.14)",
              background: active
                ? "linear-gradient(135deg, rgba(248,251,242,0.98) 0%, rgba(255,249,239,0.98) 100%)"
                : "rgba(255,255,255,0.78)",
              boxShadow: active ? "0 10px 26px rgba(80, 67, 36, 0.08)" : "none",
            }}
            type="button"
          >
            <span style={{ display: "grid", gap: 2, textAlign: "left" }}>
              <strong style={{ color: "#44321d" }}>{tab.label}</strong>
              <span className="small" style={{ margin: 0 }}>
                {tab.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VisibilityGroup({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 12,
        alignItems: "start",
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(94, 119, 69, 0.1)",
        background: "rgba(255,255,255,0.78)",
      }}
    >
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span style={{ display: "grid", gap: 4 }}>
        <strong style={{ color: "#44321d" }}>{title}</strong>
        <span className="small" style={{ margin: 0 }}>
          {description}
        </span>
      </span>
    </label>
  );
}

function VisibilityControls({
  language,
  form,
  onChange,
}: {
  language: Language;
  form: DogFormState;
  onChange: (patch: Partial<DogFormState>) => void;
}) {
  const showPhoto = form.publicProfileEnabled && form.showPhotoPublic && Boolean(form.photoUrl);
  const showAge = form.publicProfileEnabled && form.showAgePublic && Boolean(form.ageLabel);
  const showCall = form.publicProfileEnabled && form.showPhonePublic && Boolean(form.ownerPhone);
  const showNotes = form.publicProfileEnabled && form.showNotesPublic && Boolean(form.importantNotes);

  return (
    <ProfileSection
      eyebrow={language === "fr" ? "Profil public" : "Public profile"}
      title={language === "fr" ? "Comment le profil de ton chien apparaît" : "How your dog's profile appears"}
      hint={
        language === "fr"
          ? "Pense à cette section comme le mini profil public de ton chien. Tu choisis exactement ce qui est visible quand quelqu'un scanne le QR."
          : "Think of this as your dog's mini public profile. You decide exactly what appears when someone scans the QR code."
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            padding: 16,
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(248,251,242,0.95) 0%, rgba(255,249,239,0.95) 100%)",
            border: "1px solid rgba(94, 119, 69, 0.14)",
          }}
        >
          <span className="small" style={{ margin: 0, color: "#7b6b54" }}>
            {language === "fr" ? "Aperçu public en direct" : "Live public preview"}
          </span>

          <div
            style={{
              display: "grid",
              gap: 18,
              padding: 18,
              borderRadius: 24,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(94, 119, 69, 0.1)",
              boxShadow: "0 16px 36px rgba(80, 67, 36, 0.08)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 16, alignItems: "center" }}>
              {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={form.name || (language === "fr" ? "Photo du chien" : "Dog photo")}
                  src={form.photoUrl}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 24,
                    boxShadow: "0 14px 30px rgba(80, 67, 36, 0.12)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 24,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(180deg, rgba(255,249,239,1), rgba(243,248,235,1))",
                    color: "#7a705b",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    boxShadow: "0 14px 30px rgba(80, 67, 36, 0.08)",
                  }}
                >
                  OLIVE
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#eef4e3",
                    color: "#4f6b36",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {language === "fr" ? "Si tu m'as trouvé..." : "If you found me..."}
                </span>
                <strong style={{ color: "#44321d", fontSize: 28, lineHeight: 1.1 }}>
                  {form.name || (language === "fr" ? "Nom du chien" : "Dog name")}
                </strong>
                {showAge ? (
                  <span
                    style={{
                      display: "inline-flex",
                      width: "fit-content",
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "#fff7e8",
                      color: "#9a7042",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {form.ageLabel}
                  </span>
                ) : null}
                <span className="small" style={{ margin: 0 }}>
                  {language === "fr"
                    ? "Merci de m'aider à retrouver ma famille."
                    : "Thank you for helping me get back to my family."}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {showCall ? (
                <div
                  style={{
                    padding: "13px 16px",
                    borderRadius: 18,
                    background: "#5e7745",
                    color: "#fff",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {language === "fr" ? "Bouton Appeler mon parent" : "Call my human button"}
                </div>
              ) : null}

              {showNotes ? (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "#f8fbf2",
                    border: "1px solid rgba(94, 119, 69, 0.12)",
                    color: "#4b463e",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 6, color: "#5e7745" }}>
                    {language === "fr" ? "Notes importantes" : "Important notes"}
                  </strong>
                  <span className="small" style={{ margin: 0 }}>
                    {form.importantNotes}
                  </span>
                </div>
              ) : null}

              {!showCall && !showNotes ? (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "#fff9ef",
                    border: "1px solid rgba(239, 227, 203, 0.92)",
                    color: "#6f624d",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 6, color: "#9a7042" }}>
                    {language === "fr" ? "Confidentialité" : "Privacy"}
                  </strong>
                  <span className="small" style={{ margin: 0 }}>
                    {language === "fr"
                      ? "Les informations de contact sont privées pour le moment."
                      : "Contact details are private for now."}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <span className="small" style={{ margin: 0 }}>
            {summarizeVisibility(form, language)}
          </span>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, padding: "6px 0" }}>
          <input
            checked={form.publicProfileEnabled}
            onChange={(event) => onChange({ publicProfileEnabled: event.target.checked })}
            type="checkbox"
          />
          <span>{language === "fr" ? "Activer le profil public" : "Enable the public profile"}</span>
        </label>

        <div style={{ display: "grid", gap: 12, opacity: form.publicProfileEnabled ? 1 : 0.62 }}>
          <VisibilityGroup
            checked={form.showPhotoPublic || form.showAgePublic}
            description={
              language === "fr"
                ? "Photo du chien, âge ou petit descriptif. Le nom reste visible dans tous les cas."
                : "Dog photo, age or short label. The name stays visible in all cases."
            }
            disabled={!form.publicProfileEnabled}
            onChange={(checked) => onChange({ showPhotoPublic: checked, showAgePublic: checked })}
            title={language === "fr" ? "Profil de base" : "Base profile"}
          />
          <VisibilityGroup
            checked={form.showPhonePublic}
            description={
              language === "fr"
                ? "Affiche un bouton d'appel vers le parent du chien."
                : "Shows a call button for the dog's parent."
            }
            disabled={!form.publicProfileEnabled}
            onChange={(checked) => onChange({ showPhonePublic: checked })}
            title={language === "fr" ? "Contact" : "Contact"}
          />
          <VisibilityGroup
            checked={form.showNotesPublic}
            description={
              language === "fr"
                ? "Montre les notes importantes ou les consignes utiles si quelqu'un trouve le chien."
                : "Shows important notes or useful instructions if someone finds the dog."
            }
            disabled={!form.publicProfileEnabled}
            onChange={(checked) => onChange({ showNotesPublic: checked })}
            title={language === "fr" ? "Sécurité" : "Safety"}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 16,
            borderRadius: 18,
            background: "rgba(255, 249, 239, 0.92)",
            border: "1px solid rgba(239, 227, 203, 0.92)",
          }}
        >
          <strong style={{ color: "#44321d" }}>{language === "fr" ? "Réglages détaillés" : "Detailed controls"}</strong>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                checked={form.showPhotoPublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showPhotoPublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher la photo du profil" : "Show the profile photo"}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                checked={form.showAgePublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showAgePublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher l'âge ou le descriptif" : "Show age or short label"}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                checked={form.showPhonePublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showPhonePublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher le bouton d'appel" : "Show the call button"}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                checked={form.showNotesPublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showNotesPublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher les notes importantes" : "Show important notes"}</span>
            </label>
          </div>
        </div>
      </div>
    </ProfileSection>
  );
}

export function DogsClient({ language, initialDogs }: Props) {
  const [dogs, setDogs] = useState(initialDogs);
  const [editingDogId, setEditingDogId] = useState<string | null>(null);
  const [editingDog, setEditingDog] = useState<DogFormState | null>(null);
  const [editingTab, setEditingTab] = useState<EditorTab>("profile");
  const [claimForm, setClaimForm] = useState(emptyClaimState);
  const [claimTab, setClaimTab] = useState<EditorTab>("profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const claimDog = async () => {
    setSaving(true);
    resetFeedback();

    try {
      const response = await fetch("/api/account/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken: claimForm.publicToken,
          name: claimForm.name,
          photoUrl: claimForm.photoUrl,
          ageLabel: claimForm.ageLabel,
          ownerPhone: claimForm.ownerPhone,
          importantNotes: claimForm.importantNotes,
          publicProfileEnabled: claimForm.publicProfileEnabled,
          showPhotoPublic: claimForm.showPhotoPublic,
          showAgePublic: claimForm.showAgePublic,
          showPhonePublic: claimForm.showPhonePublic,
          showNotesPublic: claimForm.showNotesPublic,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        dog?: DogProfileAccount;
        error?: string;
      };

      if (!response.ok || !payload.dog) {
        setError(payload.error ?? (language === "fr" ? "Activation impossible." : "Unable to activate collar."));
        return;
      }

      setDogs((current) => [payload.dog!, ...current.filter((dog) => dog.id !== payload.dog!.id)]);
      setClaimForm(emptyClaimState());
      setMessage(
        language === "fr"
          ? "Collier activé. Les réglages de visibilité privée sont enregistrés."
          : "Collar activated. Your private visibility settings were saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDog = async () => {
    if (!editingDogId || !editingDog) return;

    setSaving(true);
    resetFeedback();

    try {
      const response = await fetch(`/api/account/dogs/${editingDogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDog),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        dog?: DogProfileAccount;
        error?: string;
      };

      if (!response.ok || !payload.dog) {
        setError(payload.error ?? (language === "fr" ? "Mise à jour impossible." : "Unable to update dog profile."));
        return;
      }

      setDogs((current) => current.map((dog) => (dog.id === payload.dog!.id ? payload.dog! : dog)));
      setEditingDogId(null);
      setEditingDog(null);
      setMessage(language === "fr" ? "Réglages du chien mis à jour." : "Dog profile settings updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {message ? <p className="small ok">{message}</p> : null}
      {error ? <p className="small" style={{ color: "#8f3b2e" }}>{error}</p> : null}

      <section className="section" style={{ background: "linear-gradient(135deg, rgba(255, 252, 246, 1) 0%, rgba(244, 237, 224, 0.88) 100%)" }}>
        <div className="card olive-product-benefit-card" style={{ padding: 24 }}>
          <p className="account-home-hero__eyebrow" style={{ marginBottom: 8 }}>
            {language === "fr" ? "Activation" : "Activation"}
          </p>
          <h2>{language === "fr" ? "Créer le profil du chien" : "Create the dog's profile"}</h2>
          <p className="small" style={{ marginTop: 8, marginBottom: 20 }}>
            {language === "fr"
              ? "Commence par l'identité du chien, ajoute les infos utiles, puis décide ce que son profil public peut montrer."
              : "Start with your dog's identity, add useful details, then decide what the public profile can show."}
          </p>

          <EditorTabs language={language} onChange={setClaimTab} value={claimTab} />

          <div className="two-col">
            {claimTab === "profile" ? (
              <>
                <ProfileSection
                  eyebrow={language === "fr" ? "Identité" : "Identity"}
                  title={language === "fr" ? "Les bases du profil" : "Profile basics"}
                  hint={
                    language === "fr"
                      ? "Le nom, la photo et un petit descriptif forment la carte d'identité du chien."
                      : "Name, photo and a short description form the dog's identity card."
                  }
                >
                  <div className="two-col">
                    <div className="field">
                      <label>{language === "fr" ? "Token QR" : "QR token"}</label>
                      <input
                        className="input"
                        value={claimForm.publicToken}
                        onChange={(event) => setClaimForm((current) => ({ ...current, publicToken: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{language === "fr" ? "Nom du chien" : "Dog name"}</label>
                      <input
                        className="input"
                        value={claimForm.name}
                        onChange={(event) => setClaimForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{language === "fr" ? "\u00c2ge ou descriptif" : "Age or short label"}</label>
                      <input
                        className="input"
                        value={claimForm.ageLabel}
                        onChange={(event) => setClaimForm((current) => ({ ...current, ageLabel: event.target.value }))}
                      />
                    </div>
                    <DogPhotoUpload
                      language={language}
                      value={claimForm.photoUrl}
                      onChange={(url) => setClaimForm((current) => ({ ...current, photoUrl: url }))}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection
                  eyebrow={language === "fr" ? "Sécurité" : "Safety"}
                  title={language === "fr" ? "Contact et informations utiles" : "Contact and useful information"}
                  hint={
                    language === "fr"
                      ? "Ces infos t'aident à retrouver ton chien rapidement. Elles peuvent rester privées si tu préfères."
                      : "These details help recover your dog quickly. They can stay private if you prefer."
                  }
                >
                  <div className="two-col">
                    <div className="field">
                      <label>{language === "fr" ? "Téléphone du parent" : "Owner phone"}</label>
                      <input
                        className="input"
                        value={claimForm.ownerPhone}
                        onChange={(event) => setClaimForm((current) => ({ ...current, ownerPhone: event.target.value }))}
                      />
                    </div>
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label>{language === "fr" ? "Notes importantes" : "Important notes"}</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={claimForm.importantNotes}
                        onChange={(event) => setClaimForm((current) => ({ ...current, importantNotes: event.target.value }))}
                      />
                    </div>
                  </div>
                </ProfileSection>
              </>
            ) : (
              <VisibilityControls
                language={language}
                form={claimForm}
                onChange={(patch) => setClaimForm((current) => ({ ...current, ...patch }))}
              />
            )}
          </div>

          <button className="btn" disabled={saving} onClick={() => void claimDog()} style={{ marginTop: 14 }} type="button">
            {saving
              ? language === "fr"
                ? "Activation..."
                : "Activating..."
              : language === "fr"
                ? "Activer ce collier"
                : "Activate this collar"}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Mes chiens" : "My dogs"}</h2>
        <p className="small" style={{ marginBottom: 20 }}>
          {language === "fr"
            ? "Chaque fiche QR peut rester active tout en gardant la majorité des informations privées."
            : "Each QR profile can stay active while keeping most information private."}
        </p>

        {dogs.length === 0 ? (
          <div className="support-lite-card" style={{ padding: 24 }}>
            <p className="small">
              {language === "fr" ? "Aucun chien actif pour le moment." : "No activated dogs yet."}
            </p>
          </div>
        ) : (
          <div className="account-orders-grid">
            {dogs.map((dog) => {
              const editing = editingDogId === dog.id && editingDog;
              return (
                <article className="account-order-card" key={dog.id}>
                  <div className="account-order-card__head">
                    <div>
                      <p className="account-home-hero__eyebrow" style={{ marginBottom: 6 }}>
                        {language === "fr" ? "Fiche canine" : "Dog profile"}
                      </p>
                      <h3 style={{ marginBottom: 6, color: "#44321d" }}>{dog.name ?? (language === "fr" ? "Sans nom" : "Unnamed")}</h3>
                      <p className="small">QR: {dog.publicToken}</p>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <span className="badge">{dog.isActive ? "ACTIVE" : "PAUSED"}</span>
                        <span className="badge">
                          {dog.publicProfileEnabled
                            ? language === "fr"
                              ? "VISIBLE"
                              : "VISIBLE"
                            : language === "fr"
                              ? "PRIVÉ"
                              : "PRIVATE"}
                        </span>
                        {dog.ageLabel ? <span className="badge">{dog.ageLabel}</span> : null}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <Link className="btn btn-secondary" href={`/dog/${dog.publicToken}`} target="_blank">
                        {language === "fr" ? "Voir page QR" : "View QR page"}
                      </Link>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => {
                          resetFeedback();
                          setEditingDogId(dog.id);
                          setEditingDog(toFormState(dog));
                          setEditingTab("profile");
                        }}
                      >
                        {language === "fr" ? "Modifier" : "Edit"}
                      </button>
                    </div>
                  </div>

                  {editing ? (
                    <div style={{ marginTop: 18 }}>
                      <EditorTabs language={language} onChange={setEditingTab} value={editingTab} />
                      <div className="two-col">
                        {editingTab === "profile" ? (
                          <>
                            <ProfileSection
                              eyebrow={language === "fr" ? "Identité" : "Identity"}
                              title={language === "fr" ? "Profil du chien" : "Dog profile"}
                            >
                              <div className="two-col">
                                <div className="field">
                                  <label>{language === "fr" ? "Nom du chien" : "Dog name"}</label>
                                  <input
                                    className="input"
                                    value={editing.name}
                                    onChange={(event) =>
                                      setEditingDog((current) => (current ? { ...current, name: event.target.value } : current))
                                    }
                                  />
                                </div>
                                <div className="field">
                                  <label>{language === "fr" ? "\u00c2ge ou descriptif" : "Age or short label"}</label>
                                  <input
                                    className="input"
                                    value={editing.ageLabel}
                                    onChange={(event) =>
                                      setEditingDog((current) => (current ? { ...current, ageLabel: event.target.value } : current))
                                    }
                                  />
                                </div>
                                <DogPhotoUpload
                                  language={language}
                                  value={editing.photoUrl}
                                  onChange={(url) =>
                                    setEditingDog((current) => (current ? { ...current, photoUrl: url } : current))
                                  }
                                />
                              </div>
                            </ProfileSection>

                            <ProfileSection
                              eyebrow={language === "fr" ? "Sécurité" : "Safety"}
                              title={language === "fr" ? "Coordonnées et notes" : "Contact and notes"}
                            >
                              <div className="two-col">
                                <div className="field">
                                  <label>{language === "fr" ? "Téléphone du parent" : "Owner phone"}</label>
                                  <input
                                    className="input"
                                    value={editing.ownerPhone}
                                    onChange={(event) =>
                                      setEditingDog((current) => (current ? { ...current, ownerPhone: event.target.value } : current))
                                    }
                                  />
                                </div>
                                <div className="field" style={{ gridColumn: "1 / -1" }}>
                                  <label>{language === "fr" ? "Notes importantes" : "Important notes"}</label>
                                  <textarea
                                    className="textarea"
                                    rows={3}
                                    value={editing.importantNotes}
                                    onChange={(event) =>
                                      setEditingDog((current) =>
                                        current ? { ...current, importantNotes: event.target.value } : current,
                                      )
                                    }
                                  />
                                </div>
                                <div className="field" style={{ gridColumn: "1 / -1" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <input
                                      checked={editing.isActive}
                                      onChange={(event) =>
                                        setEditingDog((current) =>
                                          current ? { ...current, isActive: event.target.checked } : current,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    <span>{language === "fr" ? "Le collier QR est actif" : "QR collar is active"}</span>
                                  </label>
                                </div>
                              </div>
                            </ProfileSection>
                          </>
                        ) : (
                          <VisibilityControls
                            language={language}
                            form={editing}
                            onChange={(patch) =>
                              setEditingDog((current) => (current ? { ...current, ...patch } : current))
                            }
                          />
                        )}
                      </div>

                      <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                        <button className="btn" disabled={saving} onClick={() => void saveDog()} type="button">
                          {language === "fr" ? "Enregistrer" : "Save"}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingDogId(null);
                            setEditingDog(null);
                          }}
                          type="button"
                        >
                          {language === "fr" ? "Annuler" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="account-order-card__meta" style={{ marginTop: 4 }}>
                      <div className="account-order-card__meta-block">
                        <span className="account-order-card__meta-label">
                          {language === "fr" ? "Contact enregistré" : "Stored contact"}
                        </span>
                        <p className="small" style={{ margin: 0, color: "#6f624d" }}>
                          {dog.ownerPhone ?? "-"}
                        </p>
                      </div>
                      <div className="account-order-card__meta-block">
                        <span className="account-order-card__meta-label">
                          {language === "fr" ? "Aperçu visibilité" : "Visibility summary"}
                        </span>
                        <p className="small" style={{ margin: 0, color: "#6f624d" }}>
                          {summarizeVisibility(dog, language)}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}



