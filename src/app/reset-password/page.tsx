"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { normalizeLanguage, getDictionary } from "@/lib/i18n";

function useLanguage() {
  if (typeof document === "undefined") return "fr" as const;
  const match = document.cookie.match(/maisonolive_lang=([^;]+)/);
  return normalizeLanguage(match?.[1]);
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const lang = useLanguage();
  const t = getDictionary(lang);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t.resetPasswordInvalid);
    }
  }, [token, t.resetPasswordInvalid]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError(lang === "fr" ? "Les mots de passe ne correspondent pas." : "Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError(lang === "fr" ? "Le mot de passe doit contenir au moins 8 caractères." : "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        const reason = body.error ?? "";
        if (reason === "INVALID_RESET_TOKEN" || reason === "RESET_TOKEN_EXPIRED" || reason === "RESET_TOKEN_ALREADY_USED") {
          setError(t.resetPasswordInvalid);
        } else {
          setError(lang === "fr" ? "Une erreur est survenue. Réessaie." : "Something went wrong. Please try again.");
        }
        return;
      }

      setSuccess(true);
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
            🔒
          </span>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.15rem" }}>{t.resetPasswordTitle}</h1>
            <p className="small" style={{ margin: 0 }}>{t.resetPasswordSubtitle}</p>
          </div>
        </div>

        {/* Success state */}
        {success ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="auth-alert auth-alert--ok">
              <span>✅</span> {t.resetPasswordSuccess}
            </div>
            <Link href="/" className="btn btn-full" style={{ textAlign: "center" }}>
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

            {!error || token ? (
              <form onSubmit={(e) => void onSubmit(e)}>
                <div className="field">
                  <label>{lang === "fr" ? "Nouveau mot de passe" : "New password"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🔒</span>
                    <input
                      className="input input--icon"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="small" style={{ margin: "0.25rem 0 0" }}>
                    {lang === "fr" ? "8 caractères minimum" : "Minimum 8 characters"}
                  </p>
                </div>

                <div className="field">
                  <label>{lang === "fr" ? "Confirmer le mot de passe" : "Confirm password"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🔒</span>
                    <input
                      className="input input--icon"
                      name="confirm"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button className="btn btn-full" type="submit" disabled={loading || !token} style={{ marginBottom: "0.75rem" }}>
                  {loading ? t.resetPasswordSaving : t.resetPasswordBtn}
                </button>

                <div style={{ textAlign: "center" }}>
                  <Link href="/" className="small" style={{ color: "var(--muted)" }}>
                    ← {t.backToHome}
                  </Link>
                </div>
              </form>
            ) : (
              <Link href="/" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
                {t.backToHome}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
