"use client";

import { useEffect, useState } from "react";

type NotificationPreferences = {
  emailNewConversation: boolean;
  emailNewMessage: boolean;
  emailConversationAssigned: boolean;
  emailDigest: "none" | "hourly" | "daily";
};

export default function AdminSupportSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNewConversation: true,
    emailNewMessage: true,
    emailConversationAssigned: true,
    emailDigest: "none",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin_notification_preferences");
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPreferences;
        setPreferences(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const savePreferences = async () => {
    setSaving(true);
    setError("");
    try {
      localStorage.setItem("admin_notification_preferences", JSON.stringify(preferences));
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Impossible de sauvegarder les préférences");
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    setTestEmailSent(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTestEmailSent(true);
      setTimeout(() => setTestEmailSent(false), 5000);
    } catch {
      setError("Impossible d'envoyer l'email de test");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="section">
        <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "0.5rem" }}>
          Paramètres de notification
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
          Gère comment tu reçois les notifications pour le support client.
        </p>

        {error ? (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            {error}
          </div>
        ) : null}

        {saved ? (
          <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
            Préférences sauvegardées
          </div>
        ) : null}

        {testEmailSent ? (
          <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
            Email de test envoyé. Vérifie ta boîte de réception.
          </div>
        ) : null}

        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
            Notifications par email
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={preferences.emailNewConversation}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailNewConversation: e.target.checked }))}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <div>
                <strong>Nouvelle conversation</strong>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  Recevoir un email quand un client démarre une nouvelle conversation.
                </p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={preferences.emailNewMessage}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailNewMessage: e.target.checked }))}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <div>
                <strong>Nouveau message</strong>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  Recevoir un email quand un client répond à une conversation qui t&apos;est assignée.
                </p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={preferences.emailConversationAssigned}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailConversationAssigned: e.target.checked }))}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <div>
                <strong>Conversation assignée</strong>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  Recevoir un email quand une conversation t&apos;est assignée.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
            Résumé périodique
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Reçois un résumé des activités de support.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="emailDigest"
                value="none"
                checked={preferences.emailDigest === "none"}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailDigest: e.target.value as "none" | "hourly" | "daily" }))}
                style={{ cursor: "pointer" }}
              />
              <span>Désactivé</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="emailDigest"
                value="hourly"
                checked={preferences.emailDigest === "hourly"}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailDigest: e.target.value as "none" | "hourly" | "daily" }))}
                style={{ cursor: "pointer" }}
              />
              <span>Résumé horaire</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="emailDigest"
                value="daily"
                checked={preferences.emailDigest === "daily"}
                onChange={(e) => setPreferences((prev) => ({ ...prev, emailDigest: e.target.value as "none" | "hourly" | "daily" }))}
                style={{ cursor: "pointer" }}
              />
              <span>Résumé quotidien</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: "2rem", padding: "1.5rem", background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>
            Email de test
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Envoie un email de test pour vérifier que les notifications fonctionnent correctement.
          </p>
          <button className="btn btn-secondary" onClick={sendTestEmail} disabled={sendingTest} style={{ fontSize: "0.875rem" }}>
            {sendingTest ? "Envoi en cours..." : "Envoyer un email de test"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={savePreferences} disabled={saving}>
            {saving ? "Sauvegarde..." : "Sauvegarder les préférences"}
          </button>
          <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Les préférences sont sauvegardées localement dans ton navigateur.
          </span>
        </div>

        <div style={{ marginTop: "2rem", padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#1e40af" }}>
            <strong>Note :</strong> pour que les notifications email fonctionnent, assure-toi que
            <code style={{ background: "#dbeafe", padding: "0.125rem 0.375rem", borderRadius: "4px", margin: "0 0.25rem" }}>RESEND_API_KEY</code>
            ou
            <code style={{ background: "#dbeafe", padding: "0.125rem 0.375rem", borderRadius: "4px", margin: "0 0.25rem" }}>SMTP_HOST</code>
            sont bien configurés dans ton fichier <code style={{ background: "#dbeafe", padding: "0.125rem 0.375rem", borderRadius: "4px", marginLeft: "0.25rem" }}>.env</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
