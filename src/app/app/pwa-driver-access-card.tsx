"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
};

const STORAGE_KEY = "chezolive_last_driver_run_href";

function normalizeDriverHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/driver\/run\/([^/?#]+)/);
    return match ? `/driver/run/${match[1]}` : "";
  } catch {
    // Not an absolute URL; keep validating as a token or local path.
  }

  const localMatch = trimmed.match(/^\/?driver\/run\/([^/?#]+)/);
  if (localMatch) return `/driver/run/${localMatch[1]}`;

  if (/^[a-zA-Z0-9_-]{12,}$/.test(trimmed)) {
    return `/driver/run/${trimmed}`;
  }

  return "";
}

export function PwaDriverAccessCard({ language }: Props) {
  const [draft, setDraft] = useState("");
  const [savedHref, setSavedHref] = useState("");
  const [error, setError] = useState("");

  const copy = useMemo(() => ({
    title: language === "fr" ? "Tournee livreur" : "Driver run",
    description:
      language === "fr"
        ? "Colle ton lien chauffeur ou ton token pour garder un acces rapide sur ce telephone."
        : "Paste your driver link or token to keep quick access on this phone.",
    placeholder: language === "fr" ? "Lien chauffeur ou token" : "Driver link or token",
    save: language === "fr" ? "Garder ce lien" : "Save link",
    latest: language === "fr" ? "Dernier lien livreur" : "Last driver link",
    open: language === "fr" ? "Ouvrir ma tournee" : "Open my run",
    invalid: language === "fr" ? "Lien chauffeur invalide." : "Invalid driver link.",
  }), [language]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSavedHref(localStorage.getItem(STORAGE_KEY) ?? "");
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const saveHref = () => {
    const nextHref = normalizeDriverHref(draft);
    if (!nextHref) {
      setError(copy.invalid);
      return;
    }
    localStorage.setItem(STORAGE_KEY, nextHref);
    setSavedHref(nextHref);
    setDraft("");
    setError("");
  };

  return (
    <section className="pwa-driver-card" id="livreur">
      <div>
        <p className="pwa-kicker">{language === "fr" ? "Terrain" : "Field"}</p>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <div className="pwa-driver-form">
        <label className="sr-only" htmlFor="pwa-driver-token">
          {copy.placeholder}
        </label>
        <input
          id="pwa-driver-token"
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.placeholder}
        />
        <button className="btn btn-secondary" type="button" onClick={saveHref}>
          {copy.save}
        </button>
      </div>
      {error ? <p className="pwa-driver-error">{error}</p> : null}
      {savedHref ? (
        <div className="pwa-driver-saved">
          <span>{copy.latest}</span>
          <a className="btn pwa-driver-open" href={savedHref}>
            {copy.open}
          </a>
        </div>
      ) : null}
    </section>
  );
}
