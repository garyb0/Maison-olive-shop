"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import type {
  AppNotificationDTO,
  AppNotificationPreferencesDTO,
  AppNotificationType,
} from "@/lib/app-notifications";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  publicKey: string;
  userRole?: string | null;
  initialNotifications: AppNotificationDTO[];
  initialUnreadCount: number;
  initialPreferences: AppNotificationPreferencesDTO;
};

type NavigatorWithBadges = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type BrowserPushPermission = NotificationPermission | "unsupported";

const defaultHeaders = { "Content-Type": "application/json" };
const clientHiddenNotificationTypes = new Set<AppNotificationType>(["DOG_QR_UPDATE"]);

function getClientVisibleNotifications(notifications: AppNotificationDTO[]) {
  return notifications.filter((notification) => !clientHiddenNotificationTypes.has(notification.type));
}

function getClientUnreadCount(notifications: AppNotificationDTO[], unreadCount: number) {
  const hasHiddenNotifications = notifications.some((notification) => clientHiddenNotificationTypes.has(notification.type));
  if (!hasHiddenNotifications) return unreadCount;

  return getClientVisibleNotifications(notifications).filter((notification) => !notification.readAt).length;
}

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

function canUsePush(publicKey: string) {
  return Boolean(
    publicKey &&
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
}

function getBrowserPermission(): BrowserPushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export function AppNotificationCenter({
  language,
  publicKey,
  userRole,
  initialNotifications,
  initialUnreadCount,
  initialPreferences,
}: Props) {
  const [notifications, setNotifications] = useState(getClientVisibleNotifications(initialNotifications));
  const [unreadCount, setUnreadCount] = useState(getClientUnreadCount(initialNotifications, initialUnreadCount));
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isSupported, setIsSupported] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<BrowserPushPermission>("unsupported");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = useMemo(() => ({
    title: language === "fr" ? "Centre d'actions" : "Action center",
    unread: language === "fr" ? "non lue(s)" : "unread",
    enable: language === "fr" ? "Activer les alertes utiles" : "Enable useful alerts",
    disable: language === "fr" ? "Desactiver push" : "Disable push",
    markAll: language === "fr" ? "Tout marquer lu" : "Mark all read",
    refresh: language === "fr" ? "Actualiser" : "Refresh",
    test: language === "fr" ? "Tester une notification" : "Test notification",
    empty: language === "fr" ? "Rien a signaler pour l'instant." : "Nothing to review right now.",
    unsupported: language === "fr" ? "Alertes push non disponibles ici." : "Push alerts unavailable here.",
    inApp: language === "fr" ? "Les alertes restent visibles dans l'app." : "Alerts still appear in the app.",
    enabled: language === "fr" ? "Alertes utiles activees." : "Useful alerts enabled.",
    denied: language === "fr" ? "Permission bloquee dans le navigateur." : "Permission blocked in the browser.",
    refreshed: language === "fr" ? "Centre d'actions actualise." : "Action center refreshed.",
    tested: language === "fr" ? "Notification test creee." : "Test notification created.",
    testNoPush: language === "fr"
      ? "Notification test creee dans l'app. Le push n'a pas ete tente."
      : "Test notification created in-app. Push was not attempted.",
    failed: language === "fr" ? "Impossible de mettre a jour les alertes." : "Unable to update alerts.",
    preferences: language === "fr" ? "Types d'alertes" : "Alert types",
    inAppActive: language === "fr" ? "In-app actif" : "In-app active",
    pushActive: language === "fr" ? "Push actif" : "Push active",
    pushDisabled: language === "fr" ? "Push desactive" : "Push disabled",
    blocked: language === "fr" ? "Permission bloquee" : "Permission blocked",
    notSupported: language === "fr" ? "Non supporte ici" : "Not supported here",
  }), [language]);

  const pushStatus = useMemo(() => {
    if (isNativeApp && preferences.pushEnabled) {
      return { label: copy.pushActive, tone: "ok" as const };
    }
    if (!isSupported && !isNativeApp) {
      return { label: copy.notSupported, tone: "muted" as const };
    }
    if (permission === "denied") {
      return { label: copy.blocked, tone: "warn" as const };
    }
    if (isSubscribed && preferences.pushEnabled) {
      return { label: copy.pushActive, tone: "ok" as const };
    }
    return { label: copy.pushDisabled, tone: "warn" as const };
  }, [copy.blocked, copy.notSupported, copy.pushActive, copy.pushDisabled, isNativeApp, isSubscribed, isSupported, permission, preferences.pushEnabled]);

  const preferenceItems: Array<{ key: keyof AppNotificationPreferencesDTO; label: string; description: string }> = useMemo(() => {
    const items: Array<{ key: keyof AppNotificationPreferencesDTO; label: string; description: string }> = [
      {
        key: "orderUpdates",
        label: language === "fr" ? "Commandes" : "Orders",
        description: language === "fr" ? "Creation et changements importants." : "Creation and important changes.",
      },
      {
        key: "deliveryUpdates",
        label: language === "fr" ? "Livraison" : "Delivery",
        description: language === "fr" ? "Suivi local et tournees." : "Local tracking and runs.",
      },
      {
        key: "supportUpdates",
        label: "Support",
        description: language === "fr" ? "Reponses de l'equipe." : "Team replies.",
      },
    ];

    if (userRole === "ADMIN") {
      items.push({
        key: "adminAlerts",
        label: language === "fr" ? "Alertes admin" : "Admin alerts",
        description: language === "fr" ? "Stock, support et commandes." : "Stock, support, and orders.",
      });
    }

    return items;
  }, [language, userRole]);

  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
    const supported = canUsePush(publicKey);
    setIsSupported(supported);
    setPermission(getBrowserPermission());
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

  const refreshNotifications = async (showMessage = false) => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) {
      if (showMessage) setMessage(copy.failed);
      return;
    }
    const payload = (await response.json()) as {
      notifications?: AppNotificationDTO[];
      unreadCount?: number;
    };
    const nextNotifications = Array.isArray(payload.notifications) ? payload.notifications : [];
    setNotifications(getClientVisibleNotifications(nextNotifications));
    setUnreadCount(getClientUnreadCount(
      nextNotifications,
      typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
    ));
    if (showMessage) setMessage(copy.refreshed);
  };

  const updatePreferences = async (patch: Partial<AppNotificationPreferencesDTO>) => {
    const response = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: defaultHeaders,
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setMessage(copy.failed);
      return false;
    }
    const payload = (await response.json()) as { preferences?: AppNotificationPreferencesDTO };
    if (payload.preferences) setPreferences(payload.preferences);
    if (Object.prototype.hasOwnProperty.call(patch, "pushEnabled")) {
      window.dispatchEvent(
        new CustomEvent("chezolive:native-push-sync", {
          detail: { pushEnabled: payload.preferences?.pushEnabled ?? patch.pushEnabled },
        }),
      );
    }
    return true;
  };

  const togglePreference = async (key: keyof AppNotificationPreferencesDTO) => {
    const nextValue = !preferences[key];
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: nextValue }));
    const ok = await updatePreferences({ [key]: nextValue });
    if (!ok) setPreferences(previous);
  };

  const subscribe = async () => {
    if (isNativeApp) {
      setBusy(true);
      try {
        await updatePreferences({ pushEnabled: true });
        setMessage(copy.enabled);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!isSupported) {
      setMessage(copy.unsupported);
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setMessage(copy.denied);
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration) {
        setMessage(copy.unsupported);
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
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
      if (isNativeApp) {
        await updatePreferences({ pushEnabled: false });
        setMessage(copy.inApp);
        return;
      }

      const registration = await navigator.serviceWorker?.ready.catch(() => null);
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

    if (!response.ok) {
      setMessage(copy.failed);
      return;
    }
    await refreshNotifications();
  };

  const testNotification = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: defaultHeaders,
      });
      if (!response.ok) {
        setMessage(copy.failed);
        return;
      }
      const payload = (await response.json()) as { pushAttempted?: boolean };
      await refreshNotifications();
      setMessage(payload.pushAttempted ? copy.tested : copy.testNoPush);
    } finally {
      setBusy(false);
    }
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

      <div className="pwa-notification-status-grid" aria-label={language === "fr" ? "Etat des alertes" : "Alert status"}>
        <span className="pwa-notification-status pwa-notification-status--ok">{copy.inAppActive}</span>
        <span className={`pwa-notification-status pwa-notification-status--${pushStatus.tone}`}>{pushStatus.label}</span>
      </div>

      <div className="pwa-notification-actions">
        {(isNativeApp ? preferences.pushEnabled : isSubscribed && preferences.pushEnabled) ? (
          <button className="btn btn-secondary" type="button" onClick={() => void unsubscribe()} disabled={busy}>
            {copy.disable}
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => void subscribe()} disabled={busy || (!isSupported && !isNativeApp)}>
            {copy.enable}
          </button>
        )}
        <button className="btn btn-secondary" type="button" onClick={() => void refreshNotifications(true)} disabled={busy}>
          {copy.refresh}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => void markAllRead()} disabled={busy || unreadCount < 1}>
          {copy.markAll}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => void testNotification()} disabled={busy}>
          {copy.test}
        </button>
      </div>

      <div className="pwa-notification-preferences" aria-label={copy.preferences}>
        <strong>{copy.preferences}</strong>
        <div className="pwa-notification-toggle-grid">
          {preferenceItems.map((item) => (
            <label className="pwa-notification-toggle" key={item.key}>
              <input
                type="checkbox"
                checked={Boolean(preferences[item.key])}
                onChange={() => void togglePreference(item.key)}
                disabled={busy}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      {message ? <p className="small pwa-notification-message">{message}</p> : null}
      {!isSupported && !isNativeApp ? <p className="small">{copy.inApp}</p> : null}

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
