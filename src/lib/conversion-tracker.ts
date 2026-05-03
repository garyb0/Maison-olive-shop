"use client";

import type { CONVERSION_EVENT_TYPES } from "@/lib/conversion-analytics";

type ConversionEventType = (typeof CONVERSION_EVENT_TYPES)[number];

type ConversionClientPayload = {
  productId?: string | null;
  productSlug?: string | null;
  cartTotalCents?: number | null;
  itemCount?: number | null;
  quantity?: number | null;
  paymentMethod?: "MANUAL" | "STRIPE" | null;
  deliveryMode?: string | null;
  language?: "fr" | "en" | null;
  metadata?: Record<string, string | number | boolean | null>;
};

const CONVERSION_SESSION_KEY = "chezolive_conversion_session_v1";

export function getConversionSessionKey() {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(CONVERSION_SESSION_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CONVERSION_SESSION_KEY, next);
  return next;
}

function currentPath() {
  if (typeof window === "undefined") return null;
  return window.location.pathname;
}

function referrerPath() {
  if (typeof document === "undefined" || !document.referrer) return null;

  try {
    return new URL(document.referrer).pathname;
  } catch {
    return null;
  }
}

export function trackConversionEvent(type: ConversionEventType, payload: ConversionClientPayload = {}) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    type,
    sessionKey: getConversionSessionKey(),
    ...payload,
    path: currentPath(),
    referrerPath: referrerPath(),
  });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon("/api/conversion-events", new Blob([body], { type: "application/json" }));
      if (sent) return;
    }

    void fetch("/api/conversion-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never block shopping.
  }
}
