"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import type { CurrentUser, DeliveryAddress } from "@/lib/types";
import type { Language } from "@/lib/i18n";
import QRCode from "qrcode";
import {
  CANADIAN_PROVINCE_OPTIONS,
  COUNTRY_OPTIONS,
  getAddressOptionLabel,
  normalizeCountryCode,
  normalizePostalCodeInput,
  normalizeProvinceCode,
} from "@/lib/address-fields";

type Props = {
  user: CurrentUser | null;
  language: Language;
  initialDeliveryAddresses: DeliveryAddress[];
};

type AddressFormState = {
  label: string;
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone: string;
  deliveryInstructions: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type TwoFactorFormState = {
  currentPassword: string;
  code: string;
};

type TwoFactorSetupState = {
  manualEntryKey: string;
  otpauthUri: string;
};

const MAX_DELIVERY_ADDRESSES = 3;

const emptyAddressForm = (): AddressFormState => ({
  label: "",
  shippingLine1: "",
  shippingCity: "",
  shippingRegion: "QC",
  shippingPostal: "",
  shippingCountry: "CA",
  deliveryPhone: "",
  deliveryInstructions: "",
});

const emptyPasswordForm = (): PasswordFormState => ({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const emptyTwoFactorForm = (): TwoFactorFormState => ({
  currentPassword: "",
  code: "",
});

const toAddressForm = (address: DeliveryAddress): AddressFormState => ({
  label: address.label,
  shippingLine1: address.shippingLine1,
  shippingCity: address.shippingCity,
  shippingRegion: normalizeProvinceCode(address.shippingRegion),
  shippingPostal: normalizePostalCodeInput(address.shippingPostal),
  shippingCountry: normalizeCountryCode(address.shippingCountry),
  deliveryPhone: address.deliveryPhone ?? "",
  deliveryInstructions: address.deliveryInstructions ?? "",
});

const normalizeAddressText = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const normalizePostalCode = (value: string) => value.replace(/\s+/g, "").trim().toUpperCase();

const addressesMatch = (
  left: Pick<AddressFormState, "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry">,
  right: Pick<AddressFormState, "shippingLine1" | "shippingCity" | "shippingRegion" | "shippingPostal" | "shippingCountry">,
) => (
  normalizeAddressText(left.shippingLine1) === normalizeAddressText(right.shippingLine1) &&
  normalizeAddressText(left.shippingCity) === normalizeAddressText(right.shippingCity) &&
  normalizeAddressText(left.shippingRegion) === normalizeAddressText(right.shippingRegion) &&
  normalizePostalCode(left.shippingPostal) === normalizePostalCode(right.shippingPostal) &&
  normalizeAddressText(left.shippingCountry) === normalizeAddressText(right.shippingCountry)
);

const formatAddressLabel = (address: DeliveryAddress, language: Language) => {
  if (address.label && address.label.trim() && address.label.trim() !== address.shippingLine1.trim()) {
    return address.label;
  }

  return language === "fr" ? "Adresse enregistrée" : "Saved address";
};

const isAddressComplete = (address: DeliveryAddress) =>
  Boolean(
    address.shippingLine1.trim() &&
    address.shippingCity.trim() &&
    address.shippingRegion.trim() &&
    address.shippingPostal.trim() &&
    address.shippingCountry.trim(),
  );

const formatAddressLocation = (address: DeliveryAddress) =>
  [
    address.shippingCity.trim(),
    address.shippingRegion.trim(),
    address.shippingPostal.trim(),
    address.shippingCountry.trim(),
  ].filter(Boolean).join(", ");

function AddressGlyph() {
  return (
    <span aria-hidden="true" className="account-address-glyph">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="presentation">
        <path
          d="M5 10.2L12 4.5L19 10.2V18.2C19 18.64 18.64 19 18.2 19H14.5V14.7H9.5V19H5.8C5.36 19 5 18.64 5 18.2V10.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function AccountProfileClient({ user, language, initialDeliveryAddresses }: Props) {
  const [addresses, setAddresses] = useState(initialDeliveryAddresses);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupState | null>(null);
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorQrDataUrl, setTwoFactorQrDataUrl] = useState("");
  const [twoFactorEnableForm, setTwoFactorEnableForm] = useState<TwoFactorFormState>(emptyTwoFactorForm);
  const [twoFactorDisableForm, setTwoFactorDisableForm] = useState<TwoFactorFormState>(emptyTwoFactorForm);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [newAddress, setNewAddress] = useState<AddressFormState>(emptyAddressForm);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<AddressFormState>(emptyAddressForm);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionsSaving, setSessionsSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const addressLimitReached = addresses.length >= MAX_DELIVERY_ADDRESSES;

  useEffect(() => {
    let active = true;

    if (!twoFactorSetup?.otpauthUri) {
      setTwoFactorQrDataUrl("");
      return () => {
        active = false;
      };
    }

    void QRCode.toDataURL(twoFactorSetup.otpauthUri, {
      width: 220,
      margin: 1,
      color: {
        dark: "#4a5a35",
        light: "#fffdf7",
      },
    }).then((dataUrl: string) => {
      if (active) {
        setTwoFactorQrDataUrl(dataUrl);
      }
    }).catch(() => {
      if (active) {
        setTwoFactorQrDataUrl("");
      }
    });

    return () => {
      active = false;
    };
  }, [twoFactorSetup]);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(language === "fr" ? "La confirmation ne correspond pas." : "The confirmation does not match.");
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.newPassword.length < 10) {
      setPasswordError(
        language === "fr"
          ? "Le nouveau mot de passe doit contenir au moins 10 caractères."
          : "The new password must be at least 10 characters.",
      );
      setPasswordSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          setPasswordError(language === "fr" ? "Le mot de passe actuel est invalide." : "The current password is invalid.");
          return;
        }

        if (response.status === 429) {
          setPasswordError(language === "fr" ? "Trop de tentatives. Reessaie un peu plus tard." : "Too many attempts. Try again later.");
          return;
        }

        setPasswordError(
          payload.error ?? (language === "fr" ? "Impossible de changer le mot de passe." : "Unable to change password."),
        );
        return;
      }

      setPasswordForm(emptyPasswordForm());
      setPasswordMessage(language === "fr" ? "Mot de passe mis à jour." : "Password updated.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const revokeOtherSessions = async () => {
    setSessionsSaving(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { revokedCount?: number; error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          setPasswordError(language === "fr" ? "Reconnecte-toi avant de gérer tes sessions." : "Sign in again before managing sessions.");
          return;
        }

        if (response.status === 429) {
          setPasswordError(language === "fr" ? "Trop de tentatives. Reessaie un peu plus tard." : "Too many attempts. Try again later.");
          return;
        }

        setPasswordError(
          payload.error ?? (language === "fr" ? "Impossible de déconnecter les autres sessions." : "Unable to revoke other sessions."),
        );
        return;
      }

      const count = payload.revokedCount ?? 0;
      setPasswordMessage(
        language === "fr"
          ? count > 0
            ? `${count} autre session déconnectée.`
            : "Aucune autre session active à déconnecter."
          : count > 0
            ? `${count} other session revoked.`
            : "No other active session to revoke.",
      );
    } finally {
      setSessionsSaving(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError("");
    setTwoFactorMessage("");
    setTwoFactorBackupCodes([]);

    try {
      const response = await fetch("/api/account/two-factor/setup", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as { manualEntryKey?: string; otpauthUri?: string; error?: string };
      if (!response.ok || !payload.manualEntryKey || !payload.otpauthUri) {
        setTwoFactorError(
          payload.error ?? (language === "fr" ? "Impossible de démarrer la configuration 2FA." : "Unable to start 2FA setup."),
        );
        return;
      }

      setTwoFactorSetup({
        manualEntryKey: payload.manualEntryKey,
        otpauthUri: payload.otpauthUri,
      });
      setTwoFactorEnableForm(emptyTwoFactorForm());
      setTwoFactorMessage(
        language === "fr"
          ? "Ajoute maintenant ce compte dans ton application d’authentification."
          : "Add this account to your authenticator app now.",
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const confirmTwoFactorSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError("");
    setTwoFactorMessage("");

    try {
      const response = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(twoFactorEnableForm),
      });

      const payload = (await response.json().catch(() => ({}))) as { backupCodes?: string[]; error?: string };
      if (!response.ok || !payload.backupCodes) {
        if (response.status === 401) {
          setTwoFactorError(language === "fr" ? "Mot de passe actuel ou code invalide." : "Current password or code is invalid.");
          return;
        }

        setTwoFactorError(
          payload.error ?? (language === "fr" ? "Impossible d’activer la double authentification." : "Unable to enable two-factor authentication."),
        );
        return;
      }

      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setTwoFactorEnableForm(emptyTwoFactorForm());
      setTwoFactorBackupCodes(payload.backupCodes);
      setTwoFactorMessage(
        language === "fr"
          ? "Double authentification activée. Garde tes codes de secours en lieu sûr."
          : "Two-factor authentication enabled. Keep your backup codes somewhere safe.",
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTwoFactor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorError("");
    setTwoFactorMessage("");

    try {
      const response = await fetch("/api/account/two-factor", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(twoFactorDisableForm),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setTwoFactorError(language === "fr" ? "Mot de passe actuel ou code invalide." : "Current password or code is invalid.");
          return;
        }

        setTwoFactorError(
          payload.error ?? (language === "fr" ? "Impossible de désactiver la double authentification." : "Unable to disable two-factor authentication."),
        );
        return;
      }

      setTwoFactorEnabled(false);
      setTwoFactorSetup(null);
      setTwoFactorBackupCodes([]);
      setTwoFactorDisableForm(emptyTwoFactorForm());
      setTwoFactorMessage(
        language === "fr"
          ? "Double authentification désactivée."
          : "Two-factor authentication disabled.",
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const saveNewAddress = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (addressLimitReached) {
        setError(
          language === "fr"
            ? `Tu peux enregistrer jusqu'à ${MAX_DELIVERY_ADDRESSES} adresses maximum.`
            : `You can save up to ${MAX_DELIVERY_ADDRESSES} addresses maximum.`,
        );
        return;
      }

      const duplicate = addresses.find((address) => addressesMatch(address, newAddress));
      if (duplicate) {
        setError(
          language === "fr"
            ? "Cette adresse est déjà enregistrée. Utilise l’adresse existante ou modifie-la."
            : "This address is already saved. Use the existing address or update it.",
        );
        return;
      }

      const response = await fetch("/api/account/delivery-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });

      const payload = (await response.json().catch(() => ({}))) as { address?: DeliveryAddress; error?: string };
      if (!response.ok || !payload.address) {
        setError(payload.error ?? (language === "fr" ? "Impossible d'ajouter l'adresse." : "Unable to add address."));
        return;
      }

      setAddresses((current) => [payload.address!, ...current]);
      setNewAddress(emptyAddressForm());
      setMessage(language === "fr" ? "Adresse ajoutée au carnet." : "Address added to your address book.");
    } finally {
      setSaving(false);
    }
  };

  const saveEditedAddress = async () => {
    if (!editingAddressId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const duplicate = addresses.find((address) => address.id !== editingAddressId && addressesMatch(address, editingAddress));
      if (duplicate) {
        setError(
          language === "fr"
            ? "Cette adresse est déjà enregistrée. Utilise l’adresse existante ou modifie-la."
            : "This address is already saved. Use the existing address or update it.",
        );
        return;
      }

      const response = await fetch(`/api/account/delivery-addresses/${editingAddressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingAddress),
      });

      const payload = (await response.json().catch(() => ({}))) as { address?: DeliveryAddress; error?: string };
      if (!response.ok || !payload.address) {
        setError(payload.error ?? (language === "fr" ? "Impossible de modifier l'adresse." : "Unable to update address."));
        return;
      }

      setAddresses((current) => current.map((address) => (address.id === payload.address!.id ? payload.address! : address)));
      setEditingAddressId(null);
      setEditingAddress(emptyAddressForm());
      setMessage(language === "fr" ? "Adresse mise à jour." : "Address updated.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/account/delivery-addresses/${addressId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(payload.error ?? (language === "fr" ? "Impossible de supprimer l'adresse." : "Unable to delete address."));
        return;
      }

      setAddresses((current) => current.filter((address) => address.id !== addressId));
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        setEditingAddress(emptyAddressForm());
      }
      setMessage(language === "fr" ? "Adresse supprimée." : "Address deleted.");
    } finally {
      setSaving(false);
    }
  };

  const renderAddressForm = (
    form: AddressFormState,
    onChange: (field: keyof AddressFormState, value: string) => void,
    formIdPrefix: string,
  ) => (
    <div className="two-col">
      <div className="field">
        <label htmlFor={`${formIdPrefix}-label`}>{language === "fr" ? "Nom de l'adresse (optionnel)" : "Address label (optional)"}</label>
        <input id={`${formIdPrefix}-label`} className="input" placeholder={language === "fr" ? "Ex. Maison, Travail" : "E.g. Home, Work"} value={form.label} onChange={(event) => onChange("label", event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${formIdPrefix}-phone`}>{language === "fr" ? "Téléphone pour la livraison" : "Delivery phone"}</label>
        <input id={`${formIdPrefix}-phone`} className="input" placeholder="418 555-1234" value={form.deliveryPhone} onChange={(event) => onChange("deliveryPhone", event.target.value)} />
      </div>
      <div className="field account-field-full">
        <label htmlFor={`${formIdPrefix}-line1`}>{language === "fr" ? "Adresse civique" : "Street address"}</label>
        <input id={`${formIdPrefix}-line1`} className="input" placeholder={language === "fr" ? "Ex. 123 rue des Oliviers" : "E.g. 123 Olive Street"} value={form.shippingLine1} onChange={(event) => onChange("shippingLine1", event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${formIdPrefix}-city`}>{language === "fr" ? "Ville" : "City"}</label>
        <input id={`${formIdPrefix}-city`} className="input" value={form.shippingCity} onChange={(event) => onChange("shippingCity", event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${formIdPrefix}-Région`}>{language === "fr" ? "Région" : "Region"}</label>
        <select id={`${formIdPrefix}-Région`} className="input" value={form.shippingRegion} onChange={(event) => onChange("shippingRegion", normalizeProvinceCode(event.target.value))}>
          {CANADIAN_PROVINCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {getAddressOptionLabel(option, language)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${formIdPrefix}-postal`}>{language === "fr" ? "Code postal" : "Postal code"}</label>
        <input id={`${formIdPrefix}-postal`} className="input" placeholder={language === "fr" ? "Ex. G5L1A1" : "E.g. G5L1A1"} value={form.shippingPostal} onChange={(event) => onChange("shippingPostal", normalizePostalCodeInput(event.target.value))} />
      </div>
      <div className="field">
        <label htmlFor={`${formIdPrefix}-country`}>{language === "fr" ? "Pays" : "Country"}</label>
        <select id={`${formIdPrefix}-country`} className="input" value={form.shippingCountry} onChange={(event) => onChange("shippingCountry", normalizeCountryCode(event.target.value))}>
          {COUNTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {getAddressOptionLabel(option, language)}
            </option>
          ))}
        </select>
      </div>
      <div className="field account-field-full">
        <label htmlFor={`${formIdPrefix}-instructions`}>{language === "fr" ? "Instructions de livraison" : "Delivery instructions"}</label>
        <textarea
          id={`${formIdPrefix}-instructions`}
          className="textarea"
          rows={3}
          value={form.deliveryInstructions}
          onChange={(event) => onChange("deliveryInstructions", event.target.value)}
        />
      </div>
    </div>
  );

  if (!user) {
    return null;
  }

  return (
    <section className="section account-profile-shell">
      <div className="account-section-head">
        <div>
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Profil" : "Profile"}</p>
          <h1>{language === "fr" ? "Mon profil" : "My profile"}</h1>
          <p className="small account-section-copy">
            {language === "fr" ? "Gère tes informations et ton carnet d'adresses de livraison." : "Manage your details and delivery address book."}
          </p>
        </div>
      </div>

      <div className="account-form-card account-form-card--narrow">
        <div className="two-col">
          <div className="field">
            <label>{language === "fr" ? "Prénom" : "First name"}</label>
            <input className="input" defaultValue={user.firstName} readOnly />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Nom" : "Last name"}</label>
            <input className="input" defaultValue={user.lastName} readOnly />
          </div>
          <div className="field account-field-full">
            <label>{language === "fr" ? "Adresse email" : "Email address"}</label>
            <input className="input" defaultValue={user.email} readOnly />
          </div>
        </div>
      </div>

      <div className="account-form-card account-form-card--narrow">
        <div className="account-card-head">
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Sécurité" : "Security"}</p>
          <h2>{language === "fr" ? "Sécurité du compte" : "Account security"}</h2>
        </div>
        <p className="small account-section-copy">
          {language === "fr"
            ? "Change ton mot de passe en confirmant d'abord ton mot de passe actuel."
            : "Change your password by confirming your current password first."}
        </p>

        {passwordMessage ? <p className="small ok">{passwordMessage}</p> : null}
        {passwordError ? <p className="small account-error-text">{passwordError}</p> : null}

        <form onSubmit={(event) => void changePassword(event)}>
          <div className="two-col">
            <div className="field account-field-full">
              <label htmlFor="current-password">{language === "fr" ? "Mot de passe actuel" : "Current password"}</label>
              <input
                id="current-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-password">{language === "fr" ? "Nouveau mot de passe" : "New password"}</label>
              <input
                id="new-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">{language === "fr" ? "Confirmer" : "Confirm"}</label>
              <input
                id="confirm-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                required
              />
            </div>
          </div>
          <p className="small account-field-hint">
            {language === "fr" ? "Minimum 10 caractères." : "Minimum 10 characters."}
          </p>
          <div className="account-action-row">
            <button type="submit" className="btn" disabled={passwordSaving}>
              {passwordSaving
                ? language === "fr"
                  ? "Mise à jour..."
                  : "Updating..."
                : language === "fr"
                  ? "Changer le mot de passe"
                  : "Change password"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPasswordForm(emptyPasswordForm())}>
              {language === "fr" ? "Vider" : "Clear"}
            </button>
          </div>
        </form>

        <div className="account-subcard">
          <h3>{language === "fr" ? "Sessions actives" : "Active sessions"}</h3>
          <p className="small account-section-copy">
            {language === "fr"
              ? "Si tu as ouvert ton compte ailleurs, tu peux déconnecter les autres appareils sans fermer cette session."
              : "If your account is open elsewhere, you can sign out other devices without ending this session."}
          </p>
          <button type="button" className="btn btn-secondary" disabled={sessionsSaving} onClick={() => void revokeOtherSessions()}>
            {sessionsSaving
              ? language === "fr"
                ? "Vérification..."
                : "Checking..."
              : language === "fr"
                ? "Déconnecter les autres sessions"
                : "Sign out other sessions"}
          </button>
        </div>

        {user.role === "ADMIN" ? (
          <div className="account-subcard">
            <h3>{language === "fr" ? "Double authentification" : "Two-factor authentication"}</h3>
            <p className="small account-section-copy">
              {language === "fr"
                ? "Ajoute une vérification avec une application comme Google Authenticator, 1Password ou Authy."
                : "Add an extra verification step with an app like Google Authenticator, 1Password, or Authy."}
            </p>

            {twoFactorMessage ? <p className="small ok">{twoFactorMessage}</p> : null}
            {twoFactorError ? <p className="small account-error-text">{twoFactorError}</p> : null}

            <div className={`account-status-pill account-status-pill--${twoFactorEnabled ? "ok" : "err"}`}>
              <span>{twoFactorEnabled ? "🔐" : "⚠️"}</span>
              <span>{twoFactorEnabled ? (language === "fr" ? "Activée" : "Enabled") : (language === "fr" ? "Désactivée" : "Disabled")}</span>
            </div>

            {!twoFactorEnabled ? (
              <div className="account-stack">
                {!twoFactorSetup ? (
                  <button type="button" className="btn" disabled={twoFactorLoading} onClick={() => void startTwoFactorSetup()}>
                    {twoFactorLoading
                      ? language === "fr"
                        ? "Préparation..."
                        : "Preparing..."
                      : language === "fr"
                        ? "Configurer la double authentification"
                        : "Set up two-factor authentication"}
                  </button>
                ) : (
                  <div className="account-subcard account-subcard--inner">
                    <p className="small account-section-copy">
                      {language === "fr"
                        ? "1. Ajoute un nouveau compte dans ton application d’authentification."
                        : "1. Add a new account in your authenticator app."}
                    </p>
                    {twoFactorQrDataUrl ? (
                      <div className="account-qr-wrap">
                        <div className="account-qr-card">
                          <Image
                            src={twoFactorQrDataUrl}
                            alt={language === "fr" ? "Code QR pour configurer la double authentification" : "QR code to configure two-factor authentication"}
                            width={220}
                            height={220}
                            unoptimized
                            className="account-qr-image"
                          />
                        </div>
                      </div>
                    ) : null}
                    <p className="small account-section-copy">
                      {language === "fr"
                        ? "2. Utilise cette clé manuelle si ton application ne scanne pas les liens automatiquement."
                        : "2. Use this manual key if your app does not automatically scan links."}
                    </p>
                    <div className="field account-field-spaced">
                      <label>{language === "fr" ? "Clé manuelle" : "Manual key"}</label>
                      <input className="input" value={twoFactorSetup.manualEntryKey} readOnly />
                    </div>
                    <div className="account-action-row account-action-row--spaced">
                      <a className="btn btn-secondary" href={twoFactorSetup.otpauthUri}>
                        {language === "fr" ? "Ouvrir le lien de configuration" : "Open setup link"}
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setTwoFactorSetup(null);
                          setTwoFactorEnableForm(emptyTwoFactorForm());
                          setTwoFactorError("");
                          setTwoFactorMessage("");
                        }}
                      >
                        {language === "fr" ? "Annuler" : "Cancel"}
                      </button>
                    </div>

                    <form onSubmit={(event) => void confirmTwoFactorSetup(event)}>
                      <div className="two-col">
                        <div className="field">
                          <label htmlFor="two-factor-enable-password">{language === "fr" ? "Mot de passe actuel" : "Current password"}</label>
                          <input
                            id="two-factor-enable-password"
                            className="input"
                            type="password"
                            autoComplete="current-password"
                            value={twoFactorEnableForm.currentPassword}
                            onChange={(event) => setTwoFactorEnableForm((current) => ({ ...current, currentPassword: event.target.value }))}
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="two-factor-enable-code">{language === "fr" ? "Code 2FA" : "2FA code"}</label>
                          <input
                            id="two-factor-enable-code"
                            className="input"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={twoFactorEnableForm.code}
                            onChange={(event) => setTwoFactorEnableForm((current) => ({ ...current, code: event.target.value }))}
                            placeholder={language === "fr" ? "123456" : "123456"}
                            required
                          />
                        </div>
                      </div>
                      <div className="account-action-row">
                        <button type="submit" className="btn" disabled={twoFactorLoading}>
                          {twoFactorLoading
                            ? language === "fr"
                              ? "Activation..."
                              : "Enabling..."
                            : language === "fr"
                              ? "Activer le 2FA"
                              : "Enable 2FA"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="account-stack">
                <form onSubmit={(event) => void disableTwoFactor(event)}>
                  <div className="two-col">
                    <div className="field">
                      <label htmlFor="two-factor-disable-password">{language === "fr" ? "Mot de passe actuel" : "Current password"}</label>
                      <input
                        id="two-factor-disable-password"
                        className="input"
                        type="password"
                        autoComplete="current-password"
                        value={twoFactorDisableForm.currentPassword}
                        onChange={(event) => setTwoFactorDisableForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="two-factor-disable-code">
                        {language === "fr" ? "Code ou code de secours" : "Code or backup code"}
                      </label>
                      <input
                        id="two-factor-disable-code"
                        className="input"
                        autoComplete="one-time-code"
                        value={twoFactorDisableForm.code}
                        onChange={(event) => setTwoFactorDisableForm((current) => ({ ...current, code: event.target.value }))}
                        placeholder={language === "fr" ? "123456 ou AAAA-BBBB-CCCC" : "123456 or AAAA-BBBB-CCCC"}
                        required
                      />
                    </div>
                  </div>
                  <p className="small account-field-hint">
                    {language === "fr"
                      ? "Utilise un code de ton application ou un code de secours restant."
                      : "Use a code from your app or one of your remaining backup codes."}
                  </p>
                  <div className="account-action-row">
                    <button type="submit" className="btn btn-secondary" disabled={twoFactorLoading}>
                      {twoFactorLoading
                        ? language === "fr"
                          ? "Désactivation..."
                          : "Disabling..."
                        : language === "fr"
                          ? "Désactiver le 2FA"
                          : "Disable 2FA"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {twoFactorBackupCodes.length > 0 ? (
              <div className="account-subcard account-subcard--inner">
                <h4>{language === "fr" ? "Codes de secours" : "Backup codes"}</h4>
                <p className="small account-section-copy">
                  {language === "fr"
                    ? "Conserve-les hors ligne. Chaque code ne peut servir qu’une seule fois."
                    : "Store these offline. Each code can only be used once."}
                </p>
                <div className="account-backup-code-grid">
                  {twoFactorBackupCodes.map((backupCode) => (
                    <code key={backupCode} className="account-backup-code">
                      {backupCode}
                    </code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="account-form-card account-address-book-card">
        <div className="account-section-head">
          <div>
            <p className="account-home-hero__eyebrow">{language === "fr" ? "Livraison" : "Delivery"}</p>
            <h2>{language === "fr" ? "Mes adresses de livraison" : "My delivery addresses"}</h2>
            <p className="small account-section-copy">
              {language === "fr"
                ? "Choisis, ajoute ou modifie tes adresses enregistrées."
                : "Choose, add, or edit your saved delivery addresses."}
            </p>
          </div>
          <span
            className={`account-count-pill${addressLimitReached ? " account-count-pill--limit" : ""}`}
          >
            {addresses.length} / {MAX_DELIVERY_ADDRESSES} {language === "fr" ? "adresse(s)" : "address(es)"}
          </span>
        </div>

        {message ? <p className="small ok account-feedback-text">{message}</p> : null}
        {error ? <p className="small account-error-text account-feedback-text">{error}</p> : null}

        <div className="account-address-list">
          {addresses.map((address) => {
            const editing = editingAddressId === address.id;
            const addressComplete = isAddressComplete(address);
            const addressLocation = formatAddressLocation(address);
            return (
              <div
                key={address.id}
                className={`account-address-card${address.lastUsedAt ? " account-address-card--last-used" : ""}`}
              >
                <div className="account-address-card__body">
                  <div className="account-address-card__main">
                    <AddressGlyph />
                    <div className="account-address-card__copy">
                      <div className="account-order-card__meta-label">
                        {formatAddressLabel(address, language)}
                      </div>
                      <strong className={`account-address-card__line${addressComplete ? "" : " account-address-card__line--error"}`}>
                        {address.shippingLine1.trim() || (language === "fr" ? "Adresse incomplète à corriger" : "Incomplete address to fix")}
                      </strong>
                      <div className="account-address-card__rule" />
                      <div className="small account-address-card__meta">
                        {addressLocation || (language === "fr" ? "Aucune ville ni région enregistrée." : "No city or region saved yet.")}
                      </div>
                      {!addressComplete ? (
                        <div className="small account-error-text account-address-card__note">
                          {language === "fr"
                            ? "Cette adresse est incomplète. Ouvre Modifier pour ajouter la rue, la ville et la région avant une prochaine commande."
                            : "This address is incomplete. Open Edit to add the street, city, and region before placing another order."}
                        </div>
                      ) : null}
                      {address.deliveryPhone ? (
                        <div className="small account-address-card__note">
                          {language === "fr" ? "Téléphone" : "Phone"}: {address.deliveryPhone}
                        </div>
                      ) : null}
                      {address.deliveryInstructions ? (
                        <div className="small account-address-card__note">
                          {language === "fr" ? "Instructions" : "Instructions"}: {address.deliveryInstructions}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="account-address-card__actions">
                    {address.lastUsedAt ? (
                      <span className="account-status-pill account-status-pill--ok">
                        {language === "fr" ? "Dernière utilisation" : "Last used"}
                      </span>
                    ) : <span aria-hidden="true" className="account-address-card__spacer" />}
                    <div className="account-action-row account-action-row--end">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingAddressId(address.id);
                          setEditingAddress(toAddressForm(address));
                          setError("");
                          setMessage("");
                        }}
                      >
                        {language === "fr" ? "Modifier" : "Edit"}
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void deleteAddress(address.id)}>
                        {language === "fr" ? "Supprimer" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>

                {editing ? (
                  <div className="account-address-edit">
                    {renderAddressForm(editingAddress, (field, value) => {
                      setEditingAddress((current) => ({ ...current, [field]: value }));
                    }, `edit-${address.id}`)}
                    <div className="account-action-row">
                      <button type="button" className="btn" disabled={saving} onClick={() => void saveEditedAddress()}>
                        {language === "fr" ? "Enregistrer" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingAddressId(null);
                          setEditingAddress(emptyAddressForm());
                        }}
                      >
                        {language === "fr" ? "Annuler" : "Cancel"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="account-subcard account-address-add-card">
          <div className="account-section-head">
            <div>
              <h3>{language === "fr" ? "Ajouter une adresse" : "Add an address"}</h3>
              <p className="small account-section-copy">
                {addressLimitReached
                  ? language === "fr"
                    ? `Tu as atteint la limite de ${MAX_DELIVERY_ADDRESSES} adresses. Supprime-en une pour en ajouter une nouvelle.`
                    : `You have reached the limit of ${MAX_DELIVERY_ADDRESSES} addresses. Delete one to add a new one.`
                  : language === "fr"
                    ? "Ajoute une nouvelle adresse de livraison. Les doublons exacts sont automatiquement évités."
                    : "Add a new delivery address. Exact duplicates are automatically prevented."}
              </p>
            </div>
            <span
              className={`account-count-pill${addressLimitReached ? " account-count-pill--limit" : ""}`}
            >
              {language === "fr" ? "Section d’ajout" : "Add section"}
            </span>
          </div>
          <div className="account-address-edit">
          <p className="small account-section-copy">
            {addressLimitReached
              ? language === "fr"
                ? "Ajout temporairement indisponible tant qu’une adresse existante n’est pas retirée."
                : "Adding is temporarily unavailable until one existing address is removed."
              : language === "fr"
                ? "Le carnet évite les doublons exacts pour une même adresse physique."
                : "The address book avoids exact duplicates for the same physical address."}
          </p>
          {renderAddressForm(newAddress, (field, value) => {
            setNewAddress((current) => ({ ...current, [field]: value }));
          }, "new-address")}
          <div className="account-action-row">
            <button type="button" className="btn" disabled={saving || addressLimitReached} onClick={() => void saveNewAddress()}>
              {language === "fr" ? "Ajouter au carnet" : "Add to address book"}
            </button>
            <button type="button" className="btn btn-secondary" disabled={addressLimitReached} onClick={() => setNewAddress(emptyAddressForm())}>
              {language === "fr" ? "Vider" : "Clear"}
            </button>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}



