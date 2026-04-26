"use client";

import { useState } from "react";
import Link from "next/link";
import { normalizeLanguage, getDictionary } from "@/lib/i18n";

// Read language from cookie client-side so the page is fully static-friendly
function useLanguage() {
  if (typeof document === "undefined") return "fr" as const;
  const match = document.cookie.match(/chezolive_lang=([^;]+)/);
  return normalizeLanguage(match?.[1]);
}

export default function ForgotPasswordPage() {
  const lang = useLanguage();
  const t = getDictionary(lang);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setDevResetUrl(null);
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

        const data = (await res.json()) as { resetUrl?: string };

        if (process.env.NODE_ENV === "development" && data.resetUrl) {
          setDevResetUrl(data.resetUrl);
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
      <section className="section auth-shell">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__brand">
              <span className="auth-card__icon" aria-hidden="true">🔑</span>
              <div>
                <p className="account-home-hero__eyebrow">{lang === "fr" ? "Sécurité" : "Security"}</p>
                <h1 className="auth-card__title">{t.forgotPasswordTitle}</h1>
                <p className="auth-card__text">{t.forgotPasswordSubtitle}</p>
              </div>
            </div>
          </div>

          {sent ? (
          <div className="auth-form">
            <div className="auth-alert auth-alert--ok">
              <span>✅</span> {t.forgotPasswordSent}
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="auth-alert" style={{ background: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}>
                <span>🔧</span> <strong>Mode développement:</strong> Le lien de réinitialisation est affiché ici directement, sans passage par la console.
              </div>
            )}

            {process.env.NODE_ENV === "development" && devResetUrl ? (
              <div className="auth-alert" style={{ overflowWrap: "anywhere" }}>
                <span>🔗</span>{" "}
                <a href={devResetUrl} style={{ color: "inherit", textDecoration: "underline" }}>
                  {devResetUrl}
                </a>
              </div>
            ) : null}

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

            <form onSubmit={(e) => void onSubmit(e)} className="auth-form">
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

              <button className="btn btn-full" type="submit" disabled={loading}>
                {loading ? t.forgotPasswordSending : t.forgotPasswordBtn}
              </button>

              <div className="auth-card__actions">
                <Link href="/" className="small" style={{ color: "var(--muted)" }}>
                  ← {t.backToHome}
                </Link>
              </div>
            </form>
          </>
        )}
        </div>
      </section>
    </div>
  );
}
