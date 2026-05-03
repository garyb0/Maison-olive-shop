"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  language: Language;
};

function isAppleMobile(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function PwaInstallPanel({ language }: Props) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const copy = useMemo(() => ({
    title: language === "fr" ? "Installer Chez Olive" : "Install Chez Olive",
    ready: language === "fr" ? "L'app peut etre installee sur cet appareil." : "The app can be installed on this device.",
    install: language === "fr" ? "Installer l'app" : "Install app",
    standalone: language === "fr" ? "Mode app active." : "App mode is active.",
    ios:
      language === "fr"
        ? "Sur iPhone: ouvre Partager, puis choisis Sur l'ecran d'accueil."
        : "On iPhone: open Share, then choose Add to Home Screen.",
    browser:
      language === "fr"
        ? "Si l'option n'apparait pas encore, utilise le menu du navigateur pour l'ajouter a l'ecran d'accueil."
        : "If the option does not appear yet, use the browser menu to add it to your home screen.",
    offline:
      language === "fr"
        ? "Tu es hors ligne. Les pages sensibles comme le panier, le compte et le checkout se resynchronisent au retour du reseau."
        : "You are offline. Sensitive pages like cart, account, and checkout will resync when the network returns.",
    offlineLink: language === "fr" ? "Voir la page hors ligne" : "Open offline page",
  }), [language]);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const nav = navigator as Navigator & { standalone?: boolean };
    const updateStandalone = () => setIsStandalone(media.matches || nav.standalone === true);
    const updateOnline = () => setIsOnline(navigator.onLine);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setIsStandalone(true);
    };

    updateStandalone();
    updateOnline();
    setIsIos(isAppleMobile(navigator.userAgent));

    media.addEventListener("change", updateStandalone);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      media.removeEventListener("change", updateStandalone);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  };

  return (
    <section className="pwa-install-panel" aria-label={copy.title}>
      <div>
        <p className="pwa-kicker">{copy.title}</p>
        <h2>{isStandalone || installed ? copy.standalone : copy.ready}</h2>
        <p>{isIos && !isStandalone ? copy.ios : copy.browser}</p>
      </div>

      {installEvent && !isStandalone ? (
        <button className="btn pwa-install-button" type="button" onClick={() => void promptInstall()}>
          {copy.install}
        </button>
      ) : null}

      {!isOnline ? (
        <div className="pwa-offline-banner" role="status">
          <span>{copy.offline}</span>
          <a href="/offline">{copy.offlineLink}</a>
        </div>
      ) : null}
    </section>
  );
}
