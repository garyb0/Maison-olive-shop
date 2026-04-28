"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { normalizeLanguage, getDictionary, type Language } from "@/lib/i18n";

function getCookieLanguage(): Language {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/chezolive_lang=([^;]+)/);
  return normalizeLanguage(match?.[1]);
}

function useLanguage() {
  const [language, setLanguage] = useState<Language>("fr");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setLanguage(getCookieLanguage());
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  return language;
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
      <section className="section auth-shell">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__brand">
              <Image
                src="/images/chez-olive/chezolive-logo-mark-tight.png"
                alt="Chez Olive"
                width={84}
                height={84}
                className="auth-card__logo"
                priority
              />
              <div>
                <p className="account-home-hero__eyebrow">{lang === "fr" ? "Compte" : "Account"}</p>
                <h1 className="auth-card__title">{t.resetPasswordTitle}</h1>
                <p className="auth-card__text">{t.resetPasswordSubtitle}</p>
              </div>
            </div>
          </div>

          {success ? (
          <div className="auth-form">
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
              <form onSubmit={(e) => void onSubmit(e)} className="auth-form">
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

                <button className="btn btn-full" type="submit" disabled={loading || !token}>
                  {loading ? t.resetPasswordSaving : t.resetPasswordBtn}
                </button>

                <div className="auth-card__actions">
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
      </section>
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
