"use client";

type Props = {
  language: "fr" | "en";
  supportEmail: string;
  className?: string;
  primaryLabel?: string;
  compact?: boolean;
};

export function HelpSupportActions({
  language,
  supportEmail,
  className = "",
  primaryLabel,
  compact = false,
}: Props) {
  const openSupport = () => {
    window.dispatchEvent(new CustomEvent("chezolive:support-open"));
  };

  const label =
    primaryLabel ?? (language === "fr" ? "Écrire à l’équipe" : "Message the team");

  return (
    <div className={["help-support-actions", compact ? "help-support-actions--compact" : "", className].filter(Boolean).join(" ")}>
      <button className="btn help-support-actions__primary" type="button" onClick={openSupport}>
        {label}
      </button>
      <a className="help-support-actions__email" href={`mailto:${supportEmail}`}>
        {language === "fr" ? "Ou par courriel" : "Or by email"}: {supportEmail}
      </a>
    </div>
  );
}
