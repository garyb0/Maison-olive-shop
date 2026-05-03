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
    <section className="dog-profile-section">
      <div className="dog-profile-section__head">
        <p className="account-home-hero__eyebrow">
          {eyebrow}
        </p>
        <h3>{title}</h3>
        {hint ? (
          <p className="small account-section-copy">
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
    <div className="dog-editor-tabs">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            className={`dog-editor-tab${active ? " dog-editor-tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            <span className="dog-editor-tab__copy">
              <strong>{tab.label}</strong>
              <span className="small">
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
    <label className="dog-visibility-option">
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="dog-visibility-option__copy">
        <strong>{title}</strong>
        <span className="small">
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
      <div className="dog-visibility-stack">
        <div className="dog-public-preview-shell">
          <span className="small dog-public-preview-label">
            {language === "fr" ? "Aperçu public en direct" : "Live public preview"}
          </span>

          <div className="dog-public-preview-card">
            <div className="dog-public-preview-card__head">
              {showPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={form.name || (language === "fr" ? "Photo du chien" : "Dog photo")}
                  src={form.photoUrl}
                  className="dog-public-preview-photo"
                />
              ) : (
                <div className="dog-public-preview-photo dog-public-preview-photo--placeholder">
                  OLIVE
                </div>
              )}

              <div className="dog-public-preview-copy">
                <span className="dog-public-preview-pill dog-public-preview-pill--green">
                  {language === "fr" ? "Si tu m'as trouvé..." : "If you found me..."}
                </span>
                <strong className="dog-public-preview-name">
                  {form.name || (language === "fr" ? "Nom du chien" : "Dog name")}
                </strong>
                {showAge ? (
                  <span className="dog-public-preview-pill dog-public-preview-pill--sand">
                    {form.ageLabel}
                  </span>
                ) : null}
                <span className="small account-section-copy">
                  {language === "fr"
                    ? "Merci de m'aider à retrouver ma famille."
                    : "Thank you for helping me get back to my family."}
                </span>
              </div>
            </div>

            <div className="dog-public-preview-details">
              {showCall ? (
                <div className="dog-public-preview-call">
                  {language === "fr" ? "Bouton Appeler mon parent" : "Call my human button"}
                </div>
              ) : null}

              {showNotes ? (
                <div className="dog-public-preview-note dog-public-preview-note--green">
                  <strong>
                    {language === "fr" ? "Notes importantes" : "Important notes"}
                  </strong>
                  <span className="small">
                    {form.importantNotes}
                  </span>
                </div>
              ) : null}

              {!showCall && !showNotes ? (
                <div className="dog-public-preview-note dog-public-preview-note--sand">
                  <strong>
                    {language === "fr" ? "Confidentialité" : "Privacy"}
                  </strong>
                  <span className="small">
                    {language === "fr"
                      ? "Les informations de contact sont privées pour le moment."
                      : "Contact details are private for now."}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <span className="small account-section-copy">
            {summarizeVisibility(form, language)}
          </span>
        </div>

        <label className="dog-checkbox-row dog-checkbox-row--strong">
          <input
            checked={form.publicProfileEnabled}
            onChange={(event) => onChange({ publicProfileEnabled: event.target.checked })}
            type="checkbox"
          />
          <span>{language === "fr" ? "Activer le profil public" : "Enable the public profile"}</span>
        </label>

        <div className="dog-visibility-options" data-disabled={form.publicProfileEnabled ? "false" : "true"}>
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

        <div className="dog-detail-controls">
          <strong>{language === "fr" ? "Réglages détaillés" : "Detailed controls"}</strong>
          <div className="dog-checkbox-list">
            <label className="dog-checkbox-row">
              <input
                checked={form.showPhotoPublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showPhotoPublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher la photo du profil" : "Show the profile photo"}</span>
            </label>
            <label className="dog-checkbox-row">
              <input
                checked={form.showAgePublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showAgePublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher l'âge ou le descriptif" : "Show age or short label"}</span>
            </label>
            <label className="dog-checkbox-row">
              <input
                checked={form.showPhonePublic}
                disabled={!form.publicProfileEnabled}
                onChange={(event) => onChange({ showPhonePublic: event.target.checked })}
                type="checkbox"
              />
              <span>{language === "fr" ? "Afficher le bouton d'appel" : "Show the call button"}</span>
            </label>
            <label className="dog-checkbox-row">
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
  const [claimPanelOpen, setClaimPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const openClaimPanel = () => {
    resetFeedback();
    setClaimPanelOpen(true);
    setClaimTab("profile");
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
      setClaimTab("profile");
      setClaimPanelOpen(false);
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
      {error ? <p className="small account-error-text">{error}</p> : null}

      <section className="section">
        <div className="account-section-head">
          <div>
            <p className="account-home-hero__eyebrow">{language === "fr" ? "Chiens" : "Dogs"}</p>
            <h2>{language === "fr" ? "Mes chiens" : "My dogs"}</h2>
            <p className="small account-section-copy">
              {language === "fr"
                ? "Chaque fiche QR peut rester active tout en gardant la majorité des informations privées."
                : "Each QR profile can stay active while keeping most information private."}
            </p>
          </div>
          {dogs.length > 0 ? (
            <button
              aria-controls="dog-claim-panel"
              aria-expanded={claimPanelOpen}
              className="btn btn-secondary"
              onClick={() => {
                if (claimPanelOpen) {
                  setClaimPanelOpen(false);
                  return;
                }

                openClaimPanel();
              }}
              type="button"
            >
              {claimPanelOpen
                ? language === "fr"
                  ? "Masquer l'ajout"
                  : "Hide add form"
                : language === "fr"
                  ? "Ajouter un collier QR"
                  : "Add a QR collar"}
            </button>
          ) : null}
        </div>

        {dogs.length === 0 ? (
          <div className="support-lite-card account-empty-card">
            <p className="small">
              {language === "fr" ? "Aucun chien actif pour le moment." : "No activated dogs yet."}
            </p>
            <div className="dog-empty-actions">
              <button className="btn" onClick={openClaimPanel} type="button">
                {language === "fr" ? "Activer mon premier collier" : "Activate my first collar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="account-orders-grid">
            {dogs.map((dog) => {
              const editing = editingDogId === dog.id && editingDog;
              return (
                <article className="account-order-card" key={dog.id}>
                  <div className="account-order-card__head">
                    <div className="account-order-card__identity">
                      <p className="account-home-hero__eyebrow">
                        {language === "fr" ? "Fiche canine" : "Dog profile"}
                      </p>
                      <h3 className="account-subscription-title">{dog.name ?? (language === "fr" ? "Sans nom" : "Unnamed")}</h3>
                      <p className="small">QR: {dog.publicToken}</p>
                      <div className="account-pill-row">
                        <span className={`account-status-pill account-status-pill--${dog.isActive ? "ok" : "muted"}`}>
                          {dog.isActive
                            ? language === "fr"
                              ? "Actif"
                              : "Active"
                            : language === "fr"
                              ? "En pause"
                              : "Paused"}
                        </span>
                        <span className={`account-status-pill account-status-pill--${dog.publicProfileEnabled ? "info" : "muted"}`}>
                          {dog.publicProfileEnabled
                            ? language === "fr"
                              ? "Visible"
                              : "Visible"
                            : language === "fr"
                              ? "PRIVÉ"
                              : "Private"}
                        </span>
                        {dog.ageLabel ? <span className="account-status-pill account-status-pill--muted">{dog.ageLabel}</span> : null}
                      </div>
                    </div>
                    <div className="account-action-row account-action-row--end">
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
                    <div className="dog-edit-panel">
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
                                  <label>{language === "fr" ? "Âge ou descriptif" : "Age or short label"}</label>
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
                                <div className="field account-field-full">
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
                                <div className="field account-field-full">
                                  <label className="dog-checkbox-row">
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

                      <div className="account-action-row">
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
                    <div className="account-subscription-meta">
                      <div className="account-order-card__meta-block">
                        <span className="account-order-card__meta-label">
                          {language === "fr" ? "Contact enregistré" : "Stored contact"}
                        </span>
                        <p className="small account-section-copy">
                          {dog.ownerPhone ?? "-"}
                        </p>
                      </div>
                      <div className="account-order-card__meta-block">
                        <span className="account-order-card__meta-label">
                          {language === "fr" ? "Aperçu visibilité" : "Visibility summary"}
                        </span>
                        <p className="small account-section-copy">
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

      {claimPanelOpen ? (
        <section className="section dog-activation-section" id="dog-claim-panel">
          <div className="account-form-card dog-activation-card">
            <div className="account-section-head dog-activation-card__head">
              <div>
                <p className="account-home-hero__eyebrow">
                  {language === "fr" ? "Activation" : "Activation"}
                </p>
                <h2>{language === "fr" ? "Ajouter un collier QR" : "Add a QR collar"}</h2>
                <p className="small account-section-copy">
                  {language === "fr"
                    ? "Entre le token du collier, crée la fiche du chien, puis choisis ce que le profil public peut montrer."
                    : "Enter the collar token, create the dog's profile, then choose what the public profile can show."}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setClaimPanelOpen(false)} type="button">
                {language === "fr" ? "Fermer" : "Close"}
              </button>
            </div>

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
                        <p className="small account-field-hint">
                          {language === "fr"
                            ? "Entre le code indiqué sur le collier ou colle le token du lien QR."
                            : "Enter the code printed on the collar or paste the token from the QR link."}
                        </p>
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
                        <label>{language === "fr" ? "Âge ou descriptif" : "Age or short label"}</label>
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
                      <div className="field account-field-full">
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

            <button className="btn dog-primary-action" disabled={saving} onClick={() => void claimDog()} type="button">
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
      ) : null}
    </>
  );
}



