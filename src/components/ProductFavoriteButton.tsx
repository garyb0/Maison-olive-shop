"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  productId: string;
  initialFavorited: boolean;
  isAuthenticated: boolean;
  language: Language;
  className?: string;
  onChange?: (productId: string, favorited: boolean) => void;
};

export function ProductFavoriteButton({
  productId,
  initialFavorited,
  isAuthenticated,
  language,
  className = "",
  onChange,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  const toggleFavorite = async () => {
    setNotice("");

    if (!isAuthenticated) {
      setNotice(language === "fr" ? "Connecte-toi pour garder tes essentiels." : "Sign in to save essentials.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(favorited ? `/api/account/favorites/${productId}` : "/api/account/favorites", {
        method: favorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: favorited ? undefined : JSON.stringify({ productId }),
      });

      if (!response.ok) {
        setNotice(language === "fr" ? "Impossible de mettre à jour ce favori." : "Unable to update this favorite.");
        return;
      }

      const nextFavorited = !favorited;
      setFavorited(nextFavorited);
      onChange?.(productId, nextFavorited);
      setNotice(
        nextFavorited
          ? language === "fr"
            ? "Ajouté à tes essentiels."
            : "Saved to essentials."
          : language === "fr"
            ? "Retiré des essentiels."
            : "Removed from essentials.",
      );
    } catch {
      setNotice(language === "fr" ? "Impossible de mettre à jour ce favori." : "Unable to update this favorite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`product-favorite-control ${className}`.trim()}>
      <button
        aria-pressed={favorited}
        className={`product-favorite-btn${favorited ? " product-favorite-btn--active" : ""}`}
        disabled={busy}
        onClick={() => void toggleFavorite()}
        type="button"
      >
        {favorited
          ? language === "fr"
            ? "Favori"
            : "Saved"
          : language === "fr"
            ? "Sauvegarder"
            : "Save"}
      </button>
      {notice ? <small className="product-favorite-notice">{notice}</small> : null}
    </span>
  );
}
