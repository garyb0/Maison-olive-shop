"use client";

import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
};

export function PwaSupportButton({ language }: Props) {
  return (
    <button
      className="btn btn-secondary pwa-support-button"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("chezolive:support-open"))}
    >
      {language === "fr" ? "Ecrire a l'equipe" : "Write to the team"}
    </button>
  );
}
