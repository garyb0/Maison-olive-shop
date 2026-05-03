"use client";

import { useEffect } from "react";

type DogQrViewTrackerProps = {
  publicToken: string;
};

export function DogQrViewTracker({ publicToken }: DogQrViewTrackerProps) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof fetch !== "function") return;

    const key = `chezolive:dog-qr-view:${publicToken}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Session storage can be unavailable in hardened browser modes.
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    fetch(`/api/dog/${encodeURIComponent(publicToken)}/view`, {
      method: "POST",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [publicToken]);

  return null;
}
