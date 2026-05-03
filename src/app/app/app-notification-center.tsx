"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AppNotificationDTO,
  AppNotificationPreferencesDTO,
} from "@/lib/app-notifications";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  publicKey: string;
  initialNotifications: AppNotificationDTO[];
  initialUnreadCount: number;
  initialPreferences: AppNotificationPreferencesDTO;
};

type NavigatorWithBadges = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const defaultHeaders = { "Content-Type": "application/json" };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return registration;
}

export function AppNotificationCenter({
  language,
  publicKey,
  initialNotifications,
  initialUnreadCount,
  initialPreferences,
}: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = useMemo(() => ({
    title: language === "fr" ? "Centre d'actions" : "Action center",
    unread: language === "fr" ? "non lue(s)" : "unread",
    enable: language === "fr" ? "Activer les alertes utiles" : "Enable useful alerts",
    disable: language === "fr" ? "Désactiver push" : "Disable push",
    markAll: language === "fr" ? "Tout marquer lu" : "Mark all read",
    empty: language === "fr" ? "Rien à signaler pour l'instant." : "Nothing to review right now.",
    unsupported: language === "fr" ? "Alertes push non disponibles ici." : "Push alerts unavailable here.",
    inApp: language === "fr" ? "Les alertes restent visibles dans l'app." : "Alerts still appear in the app.",
    enabled: language === "fr" ? "Alertes utiles activées." : "Useful alerts enabled.",
    denied: language === "fr" ? "Permission refusée dans le navigateur." : "Permission denied in the browser.",
  }), [language]);

  useEffect(() => {
    const supported = Boolean("serviceWorker" in navigator && "PushManager" in window && "Notification" in window && publicKey);
    setIsSupported(supported);
    if (!supported) return;

    registerServiceWorker()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(Boolean(subscription));
      })
      .catch(() => undefined);
  }, [publicKey]);

  useEffect(() => {
    const navigatorWithBadges = navigator as NavigatorWithBadges;
    if (!navigatorWithBadges.setAppBadge || !navigatorWithBadges.clearAppBadge) return;

    if (unreadCount > 0) {
      navigatorWithBadges.setAppBadge(unreadCount).catch(() => undefined);
    } else {
      navigatorWithBadges.clearAppBadge().catch(() => undefined);
    }
  }, [unreadCount]);

  const refreshNotifications = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      notifications?: AppNotificationDTO[];
      unreadCount?: number;
    };
    setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
    setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
  };

  const updatePreferences = async (patch: Partial<AppNotificationPreferencesDTO>) => {
    const response = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: defaultHeaders,
      body: JSON.stringify(patch),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { preferences?: AppNotificationPreferencesDTO };
    if (payload.preferences) setPreferences(payload.preferences);
  };

  const subscribe = async () => {
    if (!isSupported) {
      setMessage(copy.unsupported);
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(copy.denied);
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration) {
        setMessage(copy.unsupported);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        setMessage(copy.unsupported);
        return;
      }

      setIsSubscribed(true);
      await updatePreferences({ pushEnabled: true });
      setMessage(copy.enabled);
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: defaultHeaders,
        body: JSON.stringify(subscription ?? {}),
      });
      setIsSubscribed(false);
      await updatePreferences({ pushEnabled: false });
      setMessage(copy.inApp);
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: defaultHeaders,
      body: JSON.stringify({ all: true, read: true }),
    });

    if (!response.ok) return;
    await refreshNotifications();
  };

  return (
    <section className="pwa-hub-section pwa-notification-center" aria-label={copy.title}>
      <div className="pwa-section-head">
        <div>
          <p className="pwa-kicker">{language === "fr" ? "App" : "App"}</p>
          <h2>{copy.title}</h2>
        </div>
        <span className={unreadCount > 0 ? "pwa-notification-badge" : "pwa-notification-badge pwa-notification-badge--muted"}>
          {unreadCount} {copy.unread}
        </span>
      </div>

      <div className="pwa-notification-actions">
        {isSubscribed && preferences.pushEnabled ? (
          <button className="btn btn-secondary" type="button" onClick={() => void unsubscribe()} disabled={busy}>
            {copy.disable}
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => void subscribe()} disabled={busy || !publicKey}>
            {copy.enable}
          </button>
        )}
        <button className="btn btn-secondary" type="button" onClick={() => void markAllRead()} disabled={unreadCount < 1}>
          {copy.markAll}
        </button>
      </div>

      {message ? <p className="small pwa-notification-message">{message}</p> : null}
      {!isSupported ? <p className="small">{copy.inApp}</p> : null}

      <div className="pwa-notification-list">
        {notifications.length > 0 ? (
          notifications.map((notification) => {
            const content = (
              <>
                <span>{notification.readAt ? (language === "fr" ? "Lu" : "Read") : (language === "fr" ? "Nouveau" : "New")}</span>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </>
            );

            return notification.href ? (
              <Link className="pwa-notification-item" href={notification.href} key={notification.id}>
                {content}
              </Link>
            ) : (
              <div className="pwa-notification-item" key={notification.id}>
                {content}
              </div>
            );
          })
        ) : (
          <p className="admin-action-empty">{copy.empty}</p>
        )}
      </div>
    </section>
  );
}
