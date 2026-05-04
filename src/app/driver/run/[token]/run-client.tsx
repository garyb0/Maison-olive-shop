"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/lib/i18n";
import type { DeliveryRunSummary } from "@/lib/types";

type Props = {
  language: Language;
  token: string;
  gpsTrackingEnabled: boolean;
  pushPublicKey: string;
  initialRun: DeliveryRunSummary;
};

type BrowserPushPermission = NotificationPermission | "unsupported";

type DriverLocationPayload = {
  lat: number;
  lng: number;
  accuracyMeters: number;
  speedMps?: number;
  heading?: number;
  recordedAt: string;
};

type QueuedDriverAction =
  | {
      id: string;
      type: "arrive";
      stopId: string;
      payload: DriverLocationPayload;
    }
  | {
      id: string;
      type: "complete";
      stopId: string;
      result: "DELIVERED" | "FAILED";
      note?: string;
    }
  | {
      id: string;
      type: "proof";
      stopId: string;
      fileName: string;
      fileType: string;
      dataUrl: string;
      location?: DriverLocationPayload;
    };

const ARRIVAL_SUGGESTION_RADIUS_METERS = 100;

function queueStorageKey(token: string) {
  return `chezolive:driver-run-queue:${token}`;
}

function createQueuedActionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function canUseDriverPush(publicKey: string) {
  return Boolean(
    publicKey &&
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
}

function getDriverPushPermission(): BrowserPushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function registerDriverServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

function loadQueuedActions(token: string): QueuedDriverAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(queueStorageKey(token));
    return raw ? (JSON.parse(raw) as QueuedDriverAction[]) : [];
  } catch {
    return [];
  }
}

function saveQueuedActions(token: string, actions: QueuedDriverAction[]) {
  if (typeof window === "undefined") return;
  if (actions.length === 0) {
    window.localStorage.removeItem(queueStorageKey(token));
    return;
  }
  window.localStorage.setItem(queueStorageKey(token), JSON.stringify(actions));
}

function isNetworkFailure(error: unknown) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || error instanceof TypeError;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMetersBetween(left: { lat: number; lng: number }, right: { lat: number; lng: number }) {
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, name: string, type: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type });
}

function buildProofFormData(file: File, location?: DriverLocationPayload | null) {
  const formData = new FormData();
  formData.append("image", file);
  if (location) {
    formData.append("lat", String(location.lat));
    formData.append("lng", String(location.lng));
    formData.append("accuracyMeters", String(location.accuracyMeters));
    formData.append("recordedAt", location.recordedAt);
  }
  return formData;
}

function getRunStatusLabel(status: DeliveryRunSummary["status"], language: Language) {
  if (language === "fr") {
    switch (status) {
      case "DRAFT":
        return "Brouillon";
      case "PUBLISHED":
        return "Prête";
      case "IN_PROGRESS":
        return "En cours";
      case "COMPLETED":
        return "Terminée";
      case "CANCELLED":
        return "Annulée";
      default:
        return status;
    }
  }

  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Ready";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

function getStopStatusLabel(status: DeliveryRunSummary["stops"][number]["status"], language: Language) {
  if (language === "fr") {
    switch (status) {
      case "PENDING":
        return "À faire";
      case "DELIVERED":
        return "Livrée";
      case "FAILED":
        return "Échec";
      default:
        return status;
    }
  }

  switch (status) {
    case "PENDING":
      return "Pending";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function getGpsStatusLabel(status: "idle" | "watching" | "blocked" | "unsupported", language: Language) {
  if (language === "fr") {
    switch (status) {
      case "idle":
        return "GPS en attente";
      case "watching":
        return "GPS actif";
      case "blocked":
        return "GPS bloqué";
      case "unsupported":
        return "GPS indisponible";
      default:
        return status;
    }
  }

  switch (status) {
    case "idle":
      return "GPS idle";
    case "watching":
      return "GPS active";
    case "blocked":
      return "GPS blocked";
    case "unsupported":
      return "GPS unavailable";
    default:
      return status;
  }
}

function getKmSourceLabel(source: DeliveryRunSummary["actualKmSource"], language: Language) {
  if (!source) {
    return language === "fr" ? "KM à confirmer" : "KM pending";
  }

  if (language === "fr") {
    switch (source) {
      case "GPS":
        return "KM GPS";
      case "ODOMETER":
        return "KM odomètre";
      case "MANUAL_ADMIN":
        return "KM admin";
      default:
        return source;
    }
  }

  switch (source) {
    case "GPS":
      return "GPS KM";
    case "ODOMETER":
      return "Odometer KM";
    case "MANUAL_ADMIN":
      return "Admin KM";
    default:
      return source;
  }
}

function formatStopAddress(stop: DeliveryRunSummary["stops"][number]) {
  return [stop.shippingLine1, stop.shippingCity, stop.shippingPostal].filter(Boolean).join(", ");
}

function formatDistanceMeters(distanceMeters: number | null, language: Language) {
  if (distanceMeters === null) return null;
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toLocaleString(language === "fr" ? "fr-CA" : "en-CA", {
      maximumFractionDigits: 1,
    })} km`;
  }
  return `${distanceMeters.toLocaleString(language === "fr" ? "fr-CA" : "en-CA")} m`;
}

function formatEta(isoDate: string | null, language: Language) {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleTimeString(language === "fr" ? "fr-CA" : "en-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DriverRunClient({ language, token, gpsTrackingEnabled, pushPublicKey, initialRun }: Props) {
  const [run, setRun] = useState(initialRun);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushPermission, setPushPermission] = useState<BrowserPushPermission>("unsupported");
  const [pushMessage, setPushMessage] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"idle" | "watching" | "blocked" | "unsupported">("idle");
  const [odometerStartKm, setOdometerStartKm] = useState("");
  const [odometerEndKm, setOdometerEndKm] = useState("");
  const [finishNote, setFinishNote] = useState("");
  const [notesByStopId, setNotesByStopId] = useState<Record<string, string>>({});
  const [lastLocation, setLastLocation] = useState<DriverLocationPayload | null>(null);
  const [queuedActions, setQueuedActions] = useState<QueuedDriverAction[]>(() => loadQueuedActions(token));
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [proofUploadingStopId, setProofUploadingStopId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const syncingQueueRef = useRef(false);

  const nextPendingStop = useMemo(
    () => run.stops.find((stop) => stop.status === "PENDING") ?? null,
    [run.stops],
  );

  const nextStopDistanceMeters = useMemo(() => {
    if (!nextPendingStop || !lastLocation || nextPendingStop.geocodedLat === null || nextPendingStop.geocodedLng === null) {
      return null;
    }

    return distanceMetersBetween(
      { lat: lastLocation.lat, lng: lastLocation.lng },
      { lat: nextPendingStop.geocodedLat, lng: nextPendingStop.geocodedLng },
    );
  }, [lastLocation, nextPendingStop]);

  const arrivalSuggested =
    run.status === "IN_PROGRESS" &&
    nextStopDistanceMeters !== null &&
    nextStopDistanceMeters <= ARRIVAL_SUGGESTION_RADIUS_METERS;
  const nextStopDisplayDistance = formatDistanceMeters(nextStopDistanceMeters, language);
  const nextStopEta = formatEta(nextPendingStop?.plannedEta ?? null, language);
  const pushOptInVisible = run.status === "PUBLISHED" || run.status === "IN_PROGRESS";
  const pushStatus = useMemo(() => {
    if (!pushSupported) {
      return {
        label: language === "fr" ? "Non supporte ici" : "Not supported here",
        tone: "muted" as const,
      };
    }
    if (pushPermission === "denied") {
      return {
        label: language === "fr" ? "Permission bloquee" : "Permission blocked",
        tone: "warn" as const,
      };
    }
    if (pushSubscribed) {
      return {
        label: language === "fr" ? "Push actif" : "Push active",
        tone: "ok" as const,
      };
    }
    return {
      label: language === "fr" ? "Push desactive" : "Push disabled",
      tone: "warn" as const,
    };
  }, [language, pushPermission, pushSubscribed, pushSupported]);

  const callApi = useCallback(async (
    path: string,
    init?: RequestInit,
  ): Promise<{ run?: DeliveryRunSummary; accepted?: boolean; navigationHref?: string | null; warning?: string | null; error?: string }> => {
    const response = await fetch(path, init);
    const payload = (await response.json().catch(() => ({}))) as {
      run?: DeliveryRunSummary;
      accepted?: boolean;
      actualKmGps?: number | null;
      navigationHref?: string | null;
      warning?: string | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unexpected API error");
    }
    if (payload.run) {
      setRun(payload.run);
    }
    return payload;
  }, []);

  useEffect(() => {
    if (!gpsTrackingEnabled || run.status !== "IN_PROGRESS") {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus("watching");
        const locationPayload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          speedMps: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          recordedAt: new Date(position.timestamp).toISOString(),
        };
        setLastLocation(locationPayload);
        void callApi(`/api/driver/run/${token}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationPayload),
        }).catch(() => undefined);
      },
      () => setGpsStatus("blocked"),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [callApi, gpsTrackingEnabled, run.status, token]);

  useEffect(() => {
    const supported = canUseDriverPush(pushPublicKey);
    setPushSupported(supported);
    setPushPermission(getDriverPushPermission());
    if (!supported || !pushOptInVisible) return;

    registerDriverServiceWorker()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setPushSubscribed(Boolean(subscription)))
      .catch(() => undefined);
  }, [pushOptInVisible, pushPublicKey]);

  const withBusy = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  const getStartLocationPayload = async () => {
    if (!("geolocation" in navigator)) {
      return null;
    }

    return new Promise<DriverLocationPayload | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const payload = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            speedMps: position.coords.speed ?? undefined,
            heading: position.coords.heading ?? undefined,
            recordedAt: new Date(position.timestamp).toISOString(),
          };
          setLastLocation(payload);
          resolve(payload);
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        },
      );
    });
  };

  const optimizeFromCurrentPosition = async () => {
    const currentLocation = await getStartLocationPayload();

    if (!currentLocation) {
      throw new Error(language === "fr" ? "Position GPS indisponible." : "GPS position unavailable.");
    }

    const payload = await callApi(`/api/driver/run/${token}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        accuracyMeters: currentLocation.accuracyMeters,
        recordedAt: currentLocation.recordedAt,
        navigationProvider: "WAZE",
      }),
    });

    setMessage(payload.warning ?? (language === "fr" ? "Tournee reoptimisee." : "Run reoptimized."));

    if (payload.navigationHref) {
      window.open(payload.navigationHref, "_self");
    }
  };

  const persistQueuedActions = useCallback((nextActions: QueuedDriverAction[]) => {
    saveQueuedActions(token, nextActions);
    setQueuedActions(nextActions);
  }, [token]);

  const enqueueAction = (action: QueuedDriverAction) => {
    const nextActions = [...loadQueuedActions(token), action];
    persistQueuedActions(nextActions);
    setMessage(language === "fr" ? "Action en attente de synchronisation." : "Action queued for sync.");
  };

  const sendQueuedAction = useCallback(async (action: QueuedDriverAction) => {
    if (action.type === "arrive") {
      await callApi(`/api/driver/run/${token}/stops/${action.stopId}/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      return;
    }

    if (action.type === "complete") {
      await callApi(`/api/driver/run/${token}/stops/${action.stopId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: action.result,
          note: action.note,
        }),
      });
      return;
    }

    const file = await dataUrlToFile(action.dataUrl, action.fileName, action.fileType);
    await callApi(`/api/driver/run/${token}/stops/${action.stopId}/proof`, {
      method: "POST",
      body: buildProofFormData(file, action.location),
    });
  }, [callApi, token]);

  const replayQueuedActions = useCallback(async () => {
    const currentQueue = loadQueuedActions(token);
    if (!currentQueue.length || syncingQueueRef.current) return;

    syncingQueueRef.current = true;
    setSyncingQueue(true);
    const remaining: QueuedDriverAction[] = [];

    try {
      for (let index = 0; index < currentQueue.length; index += 1) {
        const action = currentQueue[index];
        try {
          await sendQueuedAction(action);
        } catch (syncError) {
          if (isNetworkFailure(syncError)) {
            remaining.push(...currentQueue.slice(index));
            break;
          }
          remaining.push(...currentQueue.slice(index + 1));
          setError(syncError instanceof Error ? syncError.message : "Unable to sync an action.");
          break;
        }
      }
    } finally {
      persistQueuedActions(remaining);
      syncingQueueRef.current = false;
      setSyncingQueue(false);
      if (currentQueue.length && remaining.length === 0) {
        setMessage(language === "fr" ? "Actions synchronisees." : "Queued actions synced.");
      }
    }
  }, [language, persistQueuedActions, sendQueuedAction, token]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQueuedActions(loadQueuedActions(token));
    }, 0);

    return () => window.clearTimeout(id);
  }, [token]);

  useEffect(() => {
    const handleOnline = () => {
      void replayQueuedActions();
    };

    window.addEventListener("online", handleOnline);
    void replayQueuedActions();

    return () => window.removeEventListener("online", handleOnline);
  }, [replayQueuedActions]);

  const markArrived = async (stop: DeliveryRunSummary["stops"][number]) => {
    const location = await getStartLocationPayload();
    if (!location) {
      throw new Error(language === "fr" ? "Position GPS indisponible." : "GPS position unavailable.");
    }

    try {
      await callApi(`/api/driver/run/${token}/stops/${stop.id}/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      setMessage(language === "fr" ? "Arrivee confirmee." : "Arrival confirmed.");
    } catch (arrivalError) {
      if (!isNetworkFailure(arrivalError)) throw arrivalError;
      enqueueAction({
        id: createQueuedActionId(),
        type: "arrive",
        stopId: stop.id,
        payload: location,
      });
    }
  };

  const completeStop = async (stop: DeliveryRunSummary["stops"][number], result: "DELIVERED" | "FAILED") => {
    const note = notesByStopId[stop.id] ?? stop.note ?? "";

    try {
      await callApi(`/api/driver/run/${token}/stops/${stop.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, note }),
      });
      setMessage(result === "DELIVERED"
        ? language === "fr" ? "Arret marque comme livre." : "Stop marked as delivered."
        : language === "fr" ? "Arret marque en echec." : "Stop marked as failed.");
    } catch (completionError) {
      if (!isNetworkFailure(completionError)) throw completionError;
      enqueueAction({
        id: createQueuedActionId(),
        type: "complete",
        stopId: stop.id,
        result,
        note,
      });
    }
  };

  const uploadProof = async (stop: DeliveryRunSummary["stops"][number], file: File | null | undefined) => {
    if (!file) return;
    setProofUploadingStopId(stop.id);
    const location = await getStartLocationPayload();

    try {
      await callApi(`/api/driver/run/${token}/stops/${stop.id}/proof`, {
        method: "POST",
        body: buildProofFormData(file, location),
      });
      setMessage(language === "fr" ? "Photo ajoutee." : "Photo added.");
    } catch (proofError) {
      if (!isNetworkFailure(proofError)) throw proofError;
      enqueueAction({
        id: createQueuedActionId(),
        type: "proof",
        stopId: stop.id,
        fileName: file.name || `proof-${stop.id}.jpg`,
        fileType: file.type || "image/jpeg",
        dataUrl: await fileToDataUrl(file),
        location: location ?? undefined,
      });
    } finally {
      setProofUploadingStopId(null);
    }
  };

  const subscribeDriverPush = async () => {
    if (!pushSupported) {
      setPushMessage(
        language === "fr"
          ? "Alertes non disponibles ici. Sur iPhone, ajoute l'app a l'ecran d'accueil."
          : "Alerts unavailable here. On iPhone, add the app to the Home Screen.",
      );
      return;
    }

    setPushBusy(true);
    setPushMessage("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPushPermission(nextPermission);
      if (nextPermission !== "granted") {
        setPushMessage(language === "fr" ? "Permission bloquee dans le navigateur." : "Permission blocked in the browser.");
        return;
      }

      const registration = await registerDriverServiceWorker();
      if (!registration) {
        setPushMessage(language === "fr" ? "Alertes non disponibles ici." : "Alerts unavailable here.");
        return;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
      });

      const response = await fetch(`/api/driver/run/${token}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        setPushMessage(language === "fr" ? "Impossible d'activer les alertes." : "Unable to enable alerts.");
        return;
      }

      setPushSubscribed(true);
      setPushMessage(language === "fr" ? "Alertes de tournee activees." : "Run alerts enabled.");
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribeDriverPush = async () => {
    setPushBusy(true);
    setPushMessage("");

    try {
      const registration = await navigator.serviceWorker?.ready.catch(() => null);
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await fetch(`/api/driver/run/${token}/push/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription ?? {}),
      });
      setPushSubscribed(false);
      setPushMessage(language === "fr" ? "Alertes de tournee desactivees." : "Run alerts disabled.");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <main className="section driver-run-shell">
      {message ? <div className="admin-callout admin-callout--ok">{message}</div> : null}
      {error ? <div className="admin-callout admin-callout--err">{error}</div> : null}
      {queuedActions.length ? (
        <div className="admin-callout admin-callout--warn driver-queue-callout">
          <span>
            {language === "fr"
              ? `${queuedActions.length} action${queuedActions.length > 1 ? "s" : ""} en attente de synchronisation.`
              : `${queuedActions.length} action${queuedActions.length > 1 ? "s" : ""} waiting to sync.`}
          </span>
          <button className="btn btn-secondary" onClick={() => void replayQueuedActions()} disabled={syncingQueue || busy}>
            {syncingQueue
              ? language === "fr"
                ? "Synchronisation..."
                : "Syncing..."
              : language === "fr"
                ? "Synchroniser"
                : "Sync"}
          </button>
        </div>
      ) : null}

      {pushOptInVisible ? (
        <div className="admin-card driver-push-card">
          <div className="driver-push-card__head">
            <div>
              <span className="admin-page-header__eyebrow">
                {language === "fr" ? "Alertes optionnelles" : "Optional alerts"}
              </span>
              <h2>{language === "fr" ? "Recevoir les alertes de cette tournee" : "Receive alerts for this run"}</h2>
              <p className="small">
                {language === "fr"
                  ? "Utile si la tournee est modifiee. Tu peux livrer meme sans l'activer."
                  : "Useful if the run changes. You can deliver without enabling it."}
              </p>
            </div>
            <span className={`driver-push-status driver-push-status--${pushStatus.tone}`}>{pushStatus.label}</span>
          </div>
          <div className="driver-push-actions">
            {pushSubscribed ? (
              <button className="btn btn-secondary" type="button" onClick={() => void unsubscribeDriverPush()} disabled={pushBusy}>
                {language === "fr" ? "Desactiver les alertes" : "Disable alerts"}
              </button>
            ) : (
              <button className="btn" type="button" onClick={() => void subscribeDriverPush()} disabled={pushBusy || !pushSupported}>
                {language === "fr" ? "Recevoir les alertes" : "Receive alerts"}
              </button>
            )}
            <span className="small">
              {language === "fr"
                ? "iPhone: ajoute l'app a l'ecran d'accueil pour le push web."
                : "iPhone: add the app to the Home Screen for web push."}
            </span>
          </div>
          {pushMessage ? <p className="small driver-push-message">{pushMessage}</p> : null}
        </div>
      ) : null}

      <div className="driver-run-header admin-card">
        <div className="driver-run-header__title">
          <span className="admin-page-header__eyebrow">
            {language === "fr" ? "Tournée chauffeur" : "Driver run"}
          </span>
          <h1>{run.driver.name}</h1>
          <p className="small">{new Date(run.deliverySlot.startAt).toLocaleString(language === "fr" ? "fr-CA" : "en-CA")}</p>
        </div>
        <div className="driver-run-pills">
          <span className="badge">{getRunStatusLabel(run.status, language)}</span>
          <span className={`badge ${gpsStatus === "watching" ? "badge--ok" : "badge--warn"}`}>
            {getGpsStatusLabel(gpsStatus, language)}
          </span>
          <span className="badge">{getKmSourceLabel(run.actualKmSource, language)}</span>
        </div>
      </div>

      <div className="driver-run-summary admin-card">
        <div>
          <span className="small">{language === "fr" ? "Prévu" : "Planned"}</span>
          <strong>{run.plannedKm?.toFixed(1) ?? "-"} km</strong>
        </div>
        <div>
          <span className="small">{language === "fr" ? "Réel" : "Actual"}</span>
          <strong>{run.actualKmFinal?.toFixed(1) ?? "-"} km</strong>
        </div>
        <div>
          <span className="small">{language === "fr" ? "Arrêts" : "Stops"}</span>
          <strong>{run.stopCounts.delivered}/{run.stopCounts.total}</strong>
        </div>
      </div>

      <div className="admin-card driver-run-control-card">
        {run.status === "PUBLISHED" || run.status === "DRAFT" ? (
          <button className="btn driver-primary-action" onClick={() => void withBusy(async () => {
            const startLocation = await getStartLocationPayload();
            await callApi(`/api/driver/run/${token}/start`, startLocation
              ? {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(startLocation),
                }
              : { method: "POST" });
            setMessage(language === "fr" ? "Tournée démarrée." : "Run started.");
          })} disabled={busy}>
            {language === "fr" ? "Démarrer la tournée" : "Start run"}
          </button>
        ) : null}

        {nextPendingStop ? (
          <div className="driver-copilot-card">
            <div className="driver-copilot-main">
              <div className="driver-copilot-kicker">
                <span className="admin-page-header__eyebrow">
                  {language === "fr" ? "Prochain arrêt" : "Next stop"}
                </span>
                <span className="badge">{getStopStatusLabel(nextPendingStop.status, language)}</span>
              </div>

              <div className="driver-copilot-title-row">
                <div>
                  <h2>{nextPendingStop.customerName}</h2>
                  <p className="driver-next-stop__address">{formatStopAddress(nextPendingStop)}</p>
                </div>
                {run.status === "IN_PROGRESS" ? (
                  <a className="btn driver-waze-action" href={nextPendingStop.wazeHref}>
                    {language === "fr" ? "Ouvrir Waze" : "Open Waze"}
                  </a>
                ) : null}
              </div>

              <div className="driver-copilot-meta">
                {nextStopEta ? (
                  <span>
                    <strong>ETA</strong> {nextStopEta}
                  </span>
                ) : null}
                {nextPendingStop.plannedLegKm !== null ? (
                  <span>
                    <strong>{language === "fr" ? "Trajet" : "Leg"}</strong> {nextPendingStop.plannedLegKm.toFixed(1)} km
                  </span>
                ) : null}
                {nextStopDisplayDistance ? (
                  <span>
                    <strong>{language === "fr" ? "Position" : "Position"}</strong> {nextStopDisplayDistance}
                  </span>
                ) : null}
                {nextPendingStop.deliveryPhone ? (
                  <a href={`tel:${nextPendingStop.deliveryPhone.replace(/[^\d+]/g, "")}`}>
                    {language === "fr" ? "Appeler" : "Call"}
                  </a>
                ) : null}
              </div>

              {nextPendingStop.deliveryInstructions ? (
                <div className="driver-instructions">
                  <span>{language === "fr" ? "Instructions" : "Instructions"}</span>
                  <p>{nextPendingStop.deliveryInstructions}</p>
                </div>
              ) : null}

              {arrivalSuggested ? (
                <div className="driver-arrival-suggestion">
                  {language === "fr" ? "Tu sembles arrivé à cet arrêt." : "You seem to have arrived at this stop."}
                </div>
              ) : null}

              <label className="driver-note-field">
                <span>{language === "fr" ? "Note terrain" : "Field note"}</span>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder={language === "fr" ? "Ajouter une note pour cet arrêt" : "Add a note for this stop"}
                  value={notesByStopId[nextPendingStop.id] ?? nextPendingStop.note ?? ""}
                  onChange={(event) =>
                    setNotesByStopId((current) => ({ ...current, [nextPendingStop.id]: event.target.value }))
                  }
                />
              </label>

              <div className="driver-proof-upload">
                <div>
                  <strong>{language === "fr" ? "Preuve photo" : "Photo proof"}</strong>
                  <p className="small">
                    {nextPendingStop.hasProofPhoto
                      ? language === "fr"
                        ? "Photo ajoutée."
                        : "Photo added."
                      : language === "fr"
                        ? "Optionnelle, utile si le colis est laissé sans contact."
                        : "Optional, useful for contactless drops."}
                  </p>
                </div>
                <label className="btn btn-secondary driver-proof-button">
                  {proofUploadingStopId === nextPendingStop.id
                    ? language === "fr"
                      ? "Envoi..."
                      : "Uploading..."
                    : language === "fr"
                      ? "Ajouter une photo"
                      : "Add photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={busy || run.status !== "IN_PROGRESS" || proofUploadingStopId === nextPendingStop.id}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void withBusy(() => uploadProof(nextPendingStop, file));
                    }}
                  />
                </label>
              </div>

              <div className="driver-copilot-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => void withBusy(() => markArrived(nextPendingStop))}
                  disabled={busy || run.status !== "IN_PROGRESS"}
                >
                  {language === "fr" ? "Je suis arrivé" : "I arrived"}
                </button>
                <button
                  className="btn"
                  onClick={() => void withBusy(() => completeStop(nextPendingStop, "DELIVERED"))}
                  disabled={busy || run.status !== "IN_PROGRESS"}
                >
                  {language === "fr" ? "Livré" : "Delivered"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => void withBusy(() => completeStop(nextPendingStop, "FAILED"))}
                  disabled={busy || run.status !== "IN_PROGRESS"}
                >
                  {language === "fr" ? "Absent / échec" : "Absent / failed"}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() =>
                    setMessage(
                      language === "fr"
                        ? "Ajoute une note, puis choisis Livré ou Absent / échec."
                        : "Add a note, then choose Delivered or Absent / failed.",
                    )
                  }
                  disabled={busy || run.status !== "IN_PROGRESS"}
                >
                  {language === "fr" ? "Problème / note" : "Issue / note"}
                </button>
              </div>
            </div>

            <div className="driver-copilot-side">
              <a href={nextPendingStop.mapsHref} target="_blank" rel="noreferrer">
                {language === "fr" ? "Voir Google Maps" : "View Google Maps"}
              </a>
              {nextPendingStop.hasProofPhoto ? (
                <a href={`/api/driver/run/${token}/stops/${nextPendingStop.id}/proof`} target="_blank" rel="noreferrer">
                  {language === "fr" ? "Voir la preuve" : "View proof"}
                </a>
              ) : null}
              <span className="small">
                {language === "fr"
                  ? "La confirmation reste manuelle, même si le GPS suggère l'arrivée."
                  : "Confirmation stays manual, even when GPS suggests arrival."}
              </span>
            </div>

            {run.status === "IN_PROGRESS" ? (
              <div className="driver-route-actions">
                <button
                  className="btn driver-primary-action"
                  onClick={() => void withBusy(optimizeFromCurrentPosition)}
                  disabled={busy}
                >
                  {language === "fr" ? "Réoptimiser depuis ma position" : "Reoptimize from my position"}
                </button>
              </div>
            ) : null}
          </div>
        ) : <p className="small">{language === "fr" ? "Tous les arrêts sont traités." : "All stops have been processed."}</p>}
      </div>

      <div className="driver-stop-stack">
        {run.stops.map((stop) => (
          <div key={stop.id} className="admin-card delivery-run-stop driver-stop-card">
            <div className="delivery-run-stop__head">
              <strong>#{stop.finalSequence} · {stop.customerName}</strong>
              <span className="badge">{getStopStatusLabel(stop.status, language)}</span>
            </div>
            <p className="small">{formatStopAddress(stop)}</p>
            <div className="delivery-run-stop__links">
              <a href={stop.mapsHref} target="_blank" rel="noreferrer">{language === "fr" ? "Maps" : "Maps"}</a>
              <a href={stop.wazeHref} target="_blank" rel="noreferrer">Waze</a>
              {stop.deliveryPhone ? <a href={`tel:${stop.deliveryPhone.replace(/[^\d+]/g, "")}`}>{language === "fr" ? "Appeler" : "Call"}</a> : null}
            </div>
            <textarea className="textarea" rows={2} placeholder={language === "fr" ? "Notes de livraison" : "Delivery notes"} value={notesByStopId[stop.id] ?? stop.note ?? ""} onChange={(event) => setNotesByStopId((current) => ({ ...current, [stop.id]: event.target.value }))} />
            {stop.status === "PENDING" ? (
              <div className="driver-stop-actions">
                <button className="btn" onClick={() => void withBusy(() => completeStop(stop, "DELIVERED"))} disabled={busy || run.status !== "IN_PROGRESS"}>{language === "fr" ? "Marquer livré" : "Mark delivered"}</button>
                <button className="btn btn-secondary" onClick={() => void withBusy(() => completeStop(stop, "FAILED"))} disabled={busy || run.status !== "IN_PROGRESS"}>{language === "fr" ? "Marquer échec" : "Mark failed"}</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="admin-card driver-finish-card">
        <h2>{language === "fr" ? "Clôturer la tournée" : "Finish run"}</h2>
        {run.status !== "IN_PROGRESS" ? (
          <p className="small">
            {run.status === "COMPLETED"
              ? language === "fr"
                ? "Cette tournée est déjà terminée."
                : "This run is already completed."
              : language === "fr"
                ? "Démarre la tournée avant de la clôturer."
                : "Start the run before finishing it."}
          </p>
        ) : null}
        <input className="input" inputMode="decimal" placeholder={language === "fr" ? "Odomètre départ (km)" : "Odometer start (km)"} value={odometerStartKm} onChange={(event) => setOdometerStartKm(event.target.value)} />
        <input className="input" inputMode="decimal" placeholder={language === "fr" ? "Odomètre fin (km)" : "Odometer end (km)"} value={odometerEndKm} onChange={(event) => setOdometerEndKm(event.target.value)} />
        <textarea className="input" rows={3} placeholder={language === "fr" ? "Note de fin de tournée" : "Run completion note"} value={finishNote} onChange={(event) => setFinishNote(event.target.value)} />
        <button className="btn driver-primary-action" onClick={() => void withBusy(async () => { await callApi(`/api/driver/run/${token}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ odometerStartKm: odometerStartKm ? Number(odometerStartKm) : undefined, odometerEndKm: odometerEndKm ? Number(odometerEndKm) : undefined, note: finishNote || undefined }) }); setMessage(language === "fr" ? "Tournée terminée." : "Run finished."); })} disabled={busy || run.status !== "IN_PROGRESS"}>{language === "fr" ? "Terminer la tournée" : "Finish run"}</button>
      </div>
    </main>
  );
}
