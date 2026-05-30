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

function compactTopLevelPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined),
  );
}

export function trackConversionEvent(type: ConversionEventType, payload: ConversionClientPayload = {}) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(compactTopLevelPayload({
    type,
    sessionKey: getConversionSessionKey(),
    ...payload,
    path: currentPath(),
    referrerPath: referrerPath(),
  }));

  try {
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
