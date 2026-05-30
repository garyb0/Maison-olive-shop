"use client";

import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

function openInternalHref(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "chezolive.ca" && parsed.hostname !== "www.chezolive.ca") return;
    window.location.href = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    if (url.startsWith("/")) {
      window.location.href = url;
    }
  }
}

function isLocalNativePreview() {
  const host = window.location.hostname;
  return (
    new URLSearchParams(window.location.search).get("native") === "1" &&
    (host === "localhost" || host === "127.0.0.1" || host === "::1")
  );
}

export function NativeAppGlobalRuntime() {
  useEffect(() => {
    const isNativePlatform = Capacitor.isNativePlatform();
    const isNative = isNativePlatform || isLocalNativePreview();
    document.documentElement.classList.toggle("is-capacitor-native", isNative);
    document.body.classList.toggle("is-capacitor-native", isNative);
    document.documentElement.dataset.nativeApp = isNative ? "chezolive" : "";
    document.body.dataset.nativeApp = isNative ? "chezolive" : "";

    if (!isNativePlatform) return undefined;

    SplashScreen.hide().catch(() => undefined);
    StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: "#FBF7EF" }).catch(() => undefined);

    const appUrlListener = CapacitorApp.addListener("appUrlOpen", (event) => openInternalHref(event.url));

    return () => {
      void appUrlListener.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
