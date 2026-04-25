"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/lib/i18n";
import type { DeliveryRunSummary } from "@/lib/types";

type Props = {
  language: Language;
  token: string;
  gpsTrackingEnabled: boolean;
  initialRun: DeliveryRunSummary;
};

export function DriverRunClient({ language, token, gpsTrackingEnabled, initialRun }: Props) {
  const [run, setRun] = useState(initialRun);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "watching" | "blocked" | "unsupported">("idle");
  const [odometerStartKm, setOdometerStartKm] = useState("");
  const [odometerEndKm, setOdometerEndKm] = useState("");
  const [finishNote, setFinishNote] = useState("");
  const [notesByStopId, setNotesByStopId] = useState<Record<string, string>>({});
  const watchIdRef = useRef<number | null>(null);

  const nextPendingStop = useMemo(
    () => run.stops.find((stop) => stop.status === "PENDING") ?? null,
    [run.stops],
  );

  const callApi = async (
    path: string,
    init?: RequestInit,
  ): Promise<{ run?: DeliveryRunSummary; accepted?: boolean; error?: string }> => {
    const response = await fetch(path, init);
    const payload = (await response.json().catch(() => ({}))) as {
      run?: DeliveryRunSummary;
      accepted?: boolean;
      actualKmGps?: number | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unexpected API error");
    }
    if (payload.run) {
      setRun(payload.run);
    }
    return payload;
  };

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
        void callApi(`/api/driver/run/${token}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            speedMps: position.coords.speed ?? undefined,
            heading: position.coords.heading ?? undefined,
            recordedAt: new Date(position.timestamp).toISOString(),
          }),
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
  }, [gpsTrackingEnabled, run.status, token]);

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

    return new Promise<{
      lat: number;
      lng: number;
      accuracyMeters: number;
      speedMps?: number;
      heading?: number;
      recordedAt: string;
    } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            speedMps: position.coords.speed ?? undefined,
            heading: position.coords.heading ?? undefined,
            recordedAt: new Date(position.timestamp).toISOString(),
          }),
        () => resolve(null),
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        },
      );
    });
  };

  return (
    <main className="section driver-run-shell">
      {message ? <div className="admin-callout admin-callout--ok">{message}</div> : null}
      {error ? <div className="admin-callout admin-callout--err">{error}</div> : null}

      <div className="driver-run-header admin-card">
        <div>
          <h1>{run.driver.name}</h1>
          <p className="small">{new Date(run.deliverySlot.startAt).toLocaleString(language === "fr" ? "fr-CA" : "en-CA")}</p>
        </div>
        <div className="driver-run-pills">
          <span className="badge">{run.status}</span>
          <span className={`badge ${gpsStatus === "watching" ? "badge--ok" : "badge--warn"}`}>GPS {gpsStatus}</span>
          <span className="badge">{run.actualKmSource ?? "KM pending"}</span>
        </div>
      </div>

      <div className="driver-run-summary admin-card">
        <div><span className="small">Planned</span><strong>{run.plannedKm?.toFixed(1) ?? "-"} km</strong></div>
        <div><span className="small">Actual</span><strong>{run.actualKmFinal?.toFixed(1) ?? "-"} km</strong></div>
        <div><span className="small">Stops</span><strong>{run.stopCounts.delivered}/{run.stopCounts.total}</strong></div>
      </div>

      <div className="admin-card">
        {run.status === "PUBLISHED" || run.status === "DRAFT" ? (
          <button className="btn" onClick={() => void withBusy(async () => {
            const startLocation = await getStartLocationPayload();
            await callApi(`/api/driver/run/${token}/start`, startLocation
              ? {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(startLocation),
                }
              : { method: "POST" });
            setMessage(language === "fr" ? "Tournee demarree." : "Run started.");
          })} disabled={busy}>
            {language === "fr" ? "Demarrer la tournee" : "Start run"}
          </button>
        ) : null}

        {nextPendingStop ? (
          <div className="driver-next-stop">
            <h2>{language === "fr" ? "Prochain arret" : "Next stop"}</h2>
            <strong>{nextPendingStop.customerName}</strong>
            <p className="small">{nextPendingStop.shippingLine1}, {nextPendingStop.shippingPostal}</p>
            <div className="delivery-run-stop__links">
              <a href={nextPendingStop.mapsHref} target="_blank" rel="noreferrer">{language === "fr" ? "Ouvrir dans Google Maps" : "Open in Google Maps"}</a>
              {nextPendingStop.deliveryPhone ? <a href={`tel:${nextPendingStop.deliveryPhone.replace(/[^\d+]/g, "")}`}>{language === "fr" ? "Appeler" : "Call"}</a> : null}
            </div>
          </div>
        ) : <p className="small">{language === "fr" ? "Tous les arrets sont traites." : "All stops have been processed."}</p>}
      </div>

      <div className="driver-stop-stack">
        {run.stops.map((stop) => (
          <div key={stop.id} className="admin-card delivery-run-stop">
            <div className="delivery-run-stop__head">
              <strong>#{stop.finalSequence} · {stop.customerName}</strong>
              <span className="badge">{stop.status}</span>
            </div>
            <p className="small">{stop.shippingLine1}, {stop.shippingCity} {stop.shippingPostal}</p>
            <div className="delivery-run-stop__links">
              <a href={stop.mapsHref} target="_blank" rel="noreferrer">{language === "fr" ? "Maps" : "Maps"}</a>
              {stop.deliveryPhone ? <a href={`tel:${stop.deliveryPhone.replace(/[^\d+]/g, "")}`}>{language === "fr" ? "Appeler" : "Call"}</a> : null}
            </div>
            <textarea className="input" rows={3} placeholder={language === "fr" ? "Notes de livraison" : "Delivery notes"} value={notesByStopId[stop.id] ?? stop.note ?? ""} onChange={(event) => setNotesByStopId((current) => ({ ...current, [stop.id]: event.target.value }))} />
            {stop.status === "PENDING" ? (
              <div className="driver-stop-actions">
                <button className="btn" onClick={() => void withBusy(async () => { await callApi(`/api/driver/run/${token}/stops/${stop.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result: "DELIVERED", note: notesByStopId[stop.id] ?? stop.note ?? "" }) }); setMessage(language === "fr" ? "Arret marque comme livre." : "Stop marked as delivered."); })} disabled={busy || run.status !== "IN_PROGRESS"}>{language === "fr" ? "Marquer livre" : "Mark delivered"}</button>
                <button className="btn btn-secondary" onClick={() => void withBusy(async () => { await callApi(`/api/driver/run/${token}/stops/${stop.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result: "FAILED", note: notesByStopId[stop.id] ?? stop.note ?? "" }) }); setMessage(language === "fr" ? "Arret marque en echec." : "Stop marked as failed."); })} disabled={busy || run.status !== "IN_PROGRESS"}>{language === "fr" ? "Marquer echec" : "Mark failed"}</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="admin-card driver-finish-card">
        <h2>{language === "fr" ? "Cloturer la tournee" : "Finish run"}</h2>
        <input className="input" inputMode="decimal" placeholder={language === "fr" ? "Odometre depart (km)" : "Odometer start (km)"} value={odometerStartKm} onChange={(event) => setOdometerStartKm(event.target.value)} />
        <input className="input" inputMode="decimal" placeholder={language === "fr" ? "Odometre fin (km)" : "Odometer end (km)"} value={odometerEndKm} onChange={(event) => setOdometerEndKm(event.target.value)} />
        <textarea className="input" rows={3} placeholder={language === "fr" ? "Note de fin de tournee" : "Run completion note"} value={finishNote} onChange={(event) => setFinishNote(event.target.value)} />
        <button className="btn" onClick={() => void withBusy(async () => { await callApi(`/api/driver/run/${token}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ odometerStartKm: odometerStartKm ? Number(odometerStartKm) : undefined, odometerEndKm: odometerEndKm ? Number(odometerEndKm) : undefined, note: finishNote || undefined }) }); setMessage(language === "fr" ? "Tournee terminee." : "Run finished."); })} disabled={busy}>{language === "fr" ? "Terminer la tournee" : "Finish run"}</button>
      </div>
    </main>
  );
}
