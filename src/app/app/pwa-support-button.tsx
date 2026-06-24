"use client";

import type { Language } from "@/lib/i18n";
import { NavIcon } from "@/components/NavIcon";

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

type SupportActionCardProps = {
  title: string;
  text: string;
  meta: string;
};

export function PwaSupportActionCard({ title, text, meta }: SupportActionCardProps) {
  return (
    <button
      className="pwa-premium-action-card pwa-premium-action-card--button"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("chezolive:support-open"))}
    >
      <span className="pwa-premium-action-icon">
        <NavIcon name="support" size={20} />
      </span>
      <span className="pwa-premium-action-copy">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <em>{meta}</em>
    </button>
  );
}
