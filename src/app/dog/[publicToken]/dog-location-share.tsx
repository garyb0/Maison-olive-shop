"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  publicToken: string;
};

export function DogLocationShare({ language, publicToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const shareLocation = () => {
    setMessage("");
    setError("");

    if (!navigator.geolocation) {
      setError(
        language === "fr"
          ? "La localisation n'est pas disponible sur cet appareil."
          : "Location is not available on this device.",
      );
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const response = await fetch(`/api/dog/${encodeURIComponent(publicToken)}/location`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
              }),
            });

            if (!response.ok) {
              setError(language === "fr" ? "Position impossible à envoyer." : "Unable to send the location.");
              return;
            }

            setMessage(
              language === "fr"
                ? "Merci. La position a été envoyée au parent."
                : "Thank you. The location was sent to the dog's parent.",
            );
          } catch {
            setError(language === "fr" ? "Position impossible à envoyer." : "Unable to send the location.");
          } finally {
            setLoading(false);
          }
        })();
      },
      () => {
        setLoading(false);
        setError(
          language === "fr"
            ? "Permission refusée ou position indisponible."
            : "Permission denied or location unavailable.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  return (
    <div className="rounded-[24px] border border-[#dfe8d0] bg-[#f8fbf2] p-4">
      <p className="text-sm font-medium text-[#4f6b36]">
        {language === "fr"
          ? "Tu peux aider sa famille en partageant ta position approximative."
          : "You can help their family by sharing your approximate location."}
      </p>
      <button
        className="mt-3 inline-flex w-full items-center justify-center rounded-[20px] bg-[#4f6b36] px-6 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(79,107,54,0.22)] transition hover:bg-[#455e30] disabled:opacity-65"
        disabled={loading}
        onClick={shareLocation}
        type="button"
      >
        {loading
          ? language === "fr"
            ? "Envoi..."
            : "Sending..."
          : language === "fr"
            ? "Partager ma position"
            : "Share my location"}
      </button>
      {message ? <p className="mt-3 text-sm font-medium text-[#4f6b36]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-[#8f3b2e]">{error}</p> : null}
    </div>
  );
}
