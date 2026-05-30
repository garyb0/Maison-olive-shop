"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";

type Props = {
  nativePushEnabled: boolean;
};

const NATIVE_PUSH_SYNC_EVENT = "chezolive:native-push-sync";

async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  const permissions = await PushNotifications.checkPermissions();
  const finalPermissions =
    permissions.receive === "prompt"
      ? await PushNotifications.requestPermissions()
      : permissions;

  if (finalPermissions.receive !== "granted") return;
  await PushNotifications.register();
}

async function postNativeToken(token: string) {
  const response = await fetch("/api/notifications/native-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "ANDROID" }),
  });

  if (!response.ok) return;
  await Preferences.set({ key: "chezolive_native_push_token", value: token });
  await Preferences.set({ key: "chezolive_native_push_registered", value: new Date().toISOString() });
}

async function disableNativeToken(token: string) {
  await fetch("/api/notifications/native-push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
  await Preferences.remove({ key: "chezolive_native_push_token" }).catch(() => undefined);
  await Preferences.remove({ key: "chezolive_native_push_registered" }).catch(() => undefined);
}

export function NativeAppRuntime({ nativePushEnabled }: Props) {
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return;

    if (Capacitor.getPlatform() === "android") {
      PushNotifications.createChannel({
        id: "chezolive-updates",
        name: "Chez Olive",
        description: "Commandes, livraison, support et rappels du compte.",
        importance: 3,
        visibility: 0,
        lights: true,
        lightColor: "#545D2E",
        vibration: true,
      }).catch(() => undefined);
    }

    const pushRegistration = PushNotifications.addListener("registration", (token) => {
      void postNativeToken(token.value);
    });
    const pushRegistrationError = PushNotifications.addListener("registrationError", () => undefined);
    const pushAction = PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const href = event.notification.data?.href;
      if (typeof href === "string" && href.startsWith("/")) window.location.href = href;
    });
    const syncNativePush = (event?: Event) => {
      const eventValue =
        event instanceof CustomEvent && typeof event.detail?.pushEnabled === "boolean"
          ? event.detail.pushEnabled
          : nativePushEnabled;

      if (eventValue) {
        void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
        void registerNativePush().catch(() => undefined);
      } else {
        void Preferences.remove({ key: "chezolive_native_push_registered" }).catch(() => undefined);
      }
    };

    window.addEventListener(NATIVE_PUSH_SYNC_EVENT, syncNativePush);
    syncNativePush();

    return () => {
      window.removeEventListener(NATIVE_PUSH_SYNC_EVENT, syncNativePush);
      void pushRegistration.then((listener) => listener.remove());
      void pushRegistrationError.then((listener) => listener.remove());
      void pushAction.then((listener) => listener.remove());
    };
  }, [nativePushEnabled]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || nativePushEnabled) return;

    const id = window.setTimeout(async () => {
      const lastToken = await Preferences.get({ key: "chezolive_native_push_token" }).catch(() => ({ value: null }));
      if (lastToken.value) await disableNativeToken(lastToken.value);
    }, 0);

    return () => window.clearTimeout(id);
  }, [nativePushEnabled]);

  return null;
}

export function dispatchNativePushSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NATIVE_PUSH_SYNC_EVENT));
  }
}
