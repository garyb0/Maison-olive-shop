"use client";

import { useEffect, useState } from "react";

type NotificationPreferences = {
  emailNewConversation: boolean;
  emailNewMessage: boolean;
  emailConversationAssigned: boolean;
  emailDigest: "none" | "hourly" | "daily";
};

type SettingsPayload = {
  preferences?: NotificationPreferences;
  emailProviderConfigured?: boolean;
  supportHealth?: {
    ok: boolean;
    missingTables?: string[];
  };
  sent?: boolean;
  to?: string;
  error?: string;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNewConversation: true,
  emailNewMessage: true,
  emailConversationAssigned: true,
  emailDigest: "none",
};

function isNotificationPreferences(value: unknown): value is NotificationPreferences {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.emailNewConversation === "boolean" &&
    typeof candidate.emailNewMessage === "boolean" &&
    typeof candidate.emailConversationAssigned === "boolean" &&
    (candidate.emailDigest === "none" ||
      candidate.emailDigest === "hourly" ||
      candidate.emailDigest === "daily")
  );
}

function getPayloadError(payload: SettingsPayload, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim().length > 0 ? payload.error : fallback;
}

export default function AdminSupportSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [emailProviderConfigured, setEmailProviderConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSentTo, setTestSentTo] = useState("");
  const [supportHealth, setSupportHealth] = useState<{ ok: boolean; missingTables: string[] }>({
    ok: true,
    missingTables: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/support/settings");
        const payload = (await response.json().catch(() => ({}))) as SettingsPayload;

        if (!response.ok) {
          throw new Error(getPayloadError(payload, "Impossible de charger les préférences"));
        }

        if (!cancelled) {
          if (isNotificationPreferences(payload.preferences)) {
            setPreferences({ ...payload.preferences, emailDigest: "none" });
          }
          setSupportHealth({
            ok: payload.supportHealth?.ok ?? true,
            missingTables: payload.supportHealth?.missingTables ?? [],
          });
          setEmailProviderConfigured(Boolean(payload.emailProviderConfigured));
        }
      } catch (settingsError) {
        if (!cancelled) {
          setError(settingsError instanceof Error ? settingsError.message : "Impossible de charger les préférences");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const savePreferences = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    setTestSentTo("");

    try {
      const response = await fetch("/api/admin/support/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...preferences, emailDigest: "none" }),
      });
      const payload = (await response.json().catch(() => ({}))) as SettingsPayload;

      if (!response.ok) {
        throw new Error(getPayloadError(payload, "Impossible de sauvegarder les préférences"));
      }

      if (isNotificationPreferences(payload.preferences)) {
        setPreferences({ ...payload.preferences, emailDigest: "none" });
      }
      setSupportHealth({
        ok: payload.supportHealth?.ok ?? true,
        missingTables: payload.supportHealth?.missingTables ?? [],
      });
      setEmailProviderConfigured(Boolean(payload.emailProviderConfigured));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder les préférences");
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setTestSending(true);
    setError("");
    setSaved(false);
    setTestSentTo("");

    try {
      const response = await fetch("/api/admin/support/settings/test-email", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as SettingsPayload;

      if (!response.ok) {
        throw new Error(getPayloadError(payload, "Impossible d'envoyer le courriel de test"));
      }

      setTestSentTo(payload.to ?? "ton adresse admin");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Impossible d'envoyer le courriel de test");
    } finally {
      setTestSending(false);
    }
  };

  return (
    <>
      <section className="section admin-page-header">
        <div className="admin-page-header__copy">
          <span className="admin-page-header__eyebrow">Support</span>
          <h1>Paramètres de notification</h1>
          <p className="small">
            Gère les notifications email du support client pour ton compte admin.
          </p>
        </div>
        <div className="admin-page-header__summary">
          <span>
            {!supportHealth.ok
              ? "Migration support requise"
              : emailProviderConfigured
                ? "Email configuré"
                : "Email à configurer"}
          </span>
        </div>
      </section>

      <section className="section admin-settings-shell">
        {error ? <div className="admin-callout admin-callout--err">{error}</div> : null}
        {!supportHealth.ok ? (
          <div className="admin-callout admin-callout--warn">
            Les réglages support ne sont pas complètement activés. Tables manquantes:{" "}
            {supportHealth.missingTables.join(", ") || "inconnues"}. Applique la migration avant d&apos;activer les emails.
          </div>
        ) : null}
        {saved ? <div className="admin-callout admin-callout--ok">Préférences sauvegardées côté serveur.</div> : null}
        {testSentTo ? <div className="admin-callout admin-callout--ok">Courriel de test envoyé à {testSentTo}.</div> : null}

        <div className="admin-settings-card">
          <div className="admin-section-head">
            <div>
              <h2>Notifications par email</h2>
              <p className="small">Choisis les événements qui doivent prévenir l’équipe admin.</p>
            </div>
          </div>

          <div className="admin-settings-options">
            <label className="admin-settings-option">
              <input
                type="checkbox"
                checked={preferences.emailNewConversation}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailNewConversation: e.target.checked }))}
              />
              <span>
                <strong>Nouvelle conversation</strong>
                <small>Recevoir un email quand un client démarre une nouvelle conversation.</small>
              </span>
            </label>

            <label className="admin-settings-option">
              <input
                type="checkbox"
                checked={preferences.emailNewMessage}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailNewMessage: e.target.checked }))}
              />
              <span>
                <strong>Nouveau message</strong>
                <small>Recevoir un email quand un client répond à une conversation qui t&apos;est assignée.</small>
              </span>
            </label>

            <label className="admin-settings-option">
              <input
                type="checkbox"
                checked={preferences.emailConversationAssigned}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailConversationAssigned: e.target.checked }))}
              />
              <span>
                <strong>Conversation assignée</strong>
                <small>Recevoir un email quand une conversation t&apos;est assignée.</small>
              </span>
            </label>
          </div>
        </div>

        <div className="admin-settings-card admin-settings-card--soft">
          <div>
            <h2>Courriel de test</h2>
            <p className="small">
              Envoie un vrai courriel de test à ton adresse admin quand un fournisseur email est configuré.
            </p>
          </div>
          <div className="admin-action-row">
            <button
              className="btn btn-secondary"
              onClick={sendTestEmail}
              disabled={loading || testSending || !emailProviderConfigured || !supportHealth.ok}
            >
              {testSending ? "Envoi en cours..." : "Envoyer un courriel de test"}
            </button>
          </div>
          {!emailProviderConfigured || !supportHealth.ok ? (
            <p className="small">
              {!supportHealth.ok
                ? "Le test sera disponible après application de la migration support."
                : "Aucun fournisseur email n'est configuré. Le test sera disponible après configuration de Resend ou SMTP."}
            </p>
          ) : null}
        </div>

        <div className="admin-settings-actions">
          <button className="btn" onClick={savePreferences} disabled={loading || saving || !supportHealth.ok}>
            {saving ? "Sauvegarde..." : "Sauvegarder les préférences"}
          </button>
          <span className="small">Les préférences sont sauvegardées pour ton compte admin.</span>
        </div>

        <div className="admin-note admin-note--info">
          <p>
            <strong>Note :</strong> pour que les notifications email fonctionnent, assure-toi que
            <code>RESEND_API_KEY</code> ou <code>SMTP_HOST</code> sont bien configurés dans ton fichier <code>.env</code>.
          </p>
        </div>
      </section>
    </>
  );
}
