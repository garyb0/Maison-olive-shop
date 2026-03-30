"use client";

import { useState } from "react";
import Link from "next/link";
import { normalizeLanguage, getDictionary } from "@/lib/i18n";

// Read language from cookie client-side so the page is fully static-friendly
function useLanguage() {
  if (typeof document === "undefined") return "fr" as const;
  const match = document.cookie.match(/maisonolive_lang=([^;]+)/);
  return normalizeLanguage(match?.[1]);
}

export default function ForgotPasswordPage() {
  const lang = useLanguage();
  const t = getDictionary(lang);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });

      if (!res.ok) {
        setError(lang === "fr" ? "Une erreur est survenue. Réessaie." : "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError(lang === "fr" ? "Erreur réseau. Réessaie." : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="section" style={{ maxWidth: 480, margin: "3rem auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <span
            style={{
              fontSize: "2rem",
              background: "var(--accent-light)",
              width: "3rem",
              height: "3rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.9rem",
              flexShrink: 0,
            }}
          >
            🔑
          </span>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.15rem" }}>{t.forgotPasswordTitle}</h1>
            <p className="small" style={{ margin: 0 }}>{t.forgotPasswordSubtitle}</p>
          </div>
        </div>

        {/* Sent confirmation */}
        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="auth-alert auth-alert--ok">
              <span>✅</span> {t.forgotPasswordSent}
            </div>
            <Link href="/" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
              {t.backToHome}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-alert auth-alert--err" style={{ marginBottom: "1rem" }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)}>
              <div className="field">
                <label>Email</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">✉️</span>
                  <input
                    className="input input--icon"
                    name="email"
                    type="email"
                    placeholder="ton@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button className="btn btn-full" type="submit" disabled={loading} style={{ marginBottom: "0.75rem" }}>
                {loading ? t.forgotPasswordSending : t.forgotPasswordBtn}
              </button>

              <div style={{ textAlign: "center" }}>
                <Link href="/" className="small" style={{ color: "var(--muted)" }}>
                  ← {t.backToHome}
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
