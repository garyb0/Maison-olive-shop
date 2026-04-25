"use client";

import { useMemo, useState } from "react";
import type { Language } from "@/lib/i18n";
import type { DeliveryDriver, DeliveryRunSummary } from "@/lib/types";

type SlotOption = {
  id: string;
  startAt: string;
  endAt: string;
  capacity: number;
  reservedCount: number;
  remainingCapacity: number;
  dateKey: string;
  note: string | null;
  isOpen: boolean;
};

type Props = {
  language: Language;
  featureEnabled: boolean;
  gpsTrackingEnabled: boolean;
  googlePlanningReady: boolean;
  schemaAvailable: boolean;
  initialDateKey: string;
  initialDrivers: DeliveryDriver[];
  initialRuns: DeliveryRunSummary[];
  initialSlots: SlotOption[];
};

type DragState = {
  runId: string;
  stopId: string;
} | null;

const RUN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#8b5cf6",
  PUBLISHED: "#2563eb",
  IN_PROGRESS: "#d97706",
  COMPLETED: "#059669",
  CANCELLED: "#b91c1c",
};

function formatDistance(value: number | null, language: Language) {
  if (value === null) return language === "fr" ? "Non calcule" : "Not calculated";
  return `${value.toFixed(1)} km`;
}

function formatDuration(value: number | null, language: Language) {
  if (value === null) return language === "fr" ? "Non calcule" : "Not calculated";
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}`;
  }
  return `${minutes} min`;
}

function formatDateTime(value: string, language: Language) {
  return new Date(value).toLocaleString(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDeliveryRunsClient({
  language,
  featureEnabled,
  gpsTrackingEnabled,
  googlePlanningReady,
  schemaAvailable,
  initialDateKey,
  initialDrivers,
  initialRuns,
  initialSlots,
}: Props) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [runs, setRuns] = useState(initialRuns);
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0]?.id ?? "");
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [selectedSlotId, setSelectedSlotId] = useState(initialSlots[0]?.id ?? "");
  const [selectedDriverId, setSelectedDriverId] = useState(initialDrivers[0]?.id ?? "");
  const [includeReturn, setIncludeReturn] = useState(true);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [manualActualKmFinal, setManualActualKmFinal] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const activeDrivers = useMemo(
    () => drivers.filter((driver) => driver.isActive),
    [drivers],
  );

  const slotOptions = useMemo(
    () => initialSlots.filter((slot) => slot.dateKey >= selectedDateKey),
    [initialSlots, selectedDateKey],
  );

  const applyRunUpdate = (run: DeliveryRunSummary) => {
    setRuns((current) => {
      const next = current.some((row) => row.id === run.id)
        ? current.map((row) => (row.id === run.id ? run : row))
        : [...current, run];
      return [...next].sort((left, right) => left.deliverySlot.startAt.localeCompare(right.deliverySlot.startAt));
    });
    setSelectedRunId(run.id);
  };

  const refreshRuns = async (dateKey = selectedDateKey) => {
    const response = await fetch(`/api/admin/delivery/runs?date=${encodeURIComponent(dateKey)}`);
    const payload = (await response.json().catch(() => ({}))) as { runs?: DeliveryRunSummary[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh delivery runs.");
    }
    setRuns(payload.runs ?? []);
    setSelectedRunId((current) => payload.runs?.some((run) => run.id === current) ? current : payload.runs?.[0]?.id ?? "");
  };

  const refreshDrivers = async () => {
    const response = await fetch("/api/admin/delivery/drivers");
    const payload = (await response.json().catch(() => ({}))) as { drivers?: DeliveryDriver[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh drivers.");
    }
    setDrivers(payload.drivers ?? []);
    setSelectedDriverId((current) => payload.drivers?.some((driver) => driver.id === current) ? current : payload.drivers?.find((driver) => driver.isActive)?.id ?? "");
  };

  const runAction = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await task();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  };

  const createDriver = async () => {
    await runAction(async () => {
      const response = await fetch("/api/admin/delivery/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: driverName, phone: driverPhone }),
      });
      const payload = (await response.json().catch(() => ({}))) as { driver?: DeliveryDriver; error?: string };
      if (!response.ok || !payload.driver) {
        throw new Error(payload.error ?? "Unable to create driver.");
      }
      const createdDriver = payload.driver;
      setDriverName("");
      setDriverPhone("");
      setDrivers((current) =>
        [...current, createdDriver].sort(
          (left, right) =>
            Number(right.isActive) - Number(left.isActive) ||
            left.name.localeCompare(right.name),
        ),
      );
      setSelectedDriverId(createdDriver.id);
      setMessage(language === "fr" ? "Chauffeur ajoute." : "Driver added.");
    });
  };

  const createRun = async () => {
    await runAction(async () => {
      const response = await fetch("/api/admin/delivery/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverySlotId: selectedSlotId,
          driverId: selectedDriverId,
          includeReturnToDepot: includeReturn,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { run?: DeliveryRunSummary; reusedExisting?: boolean; error?: string };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Unable to create run.");
      }
      applyRunUpdate(payload.run);
      setMessage(
        payload.reusedExisting
          ? language === "fr"
            ? "Une tournee existait deja pour ce creneau."
            : "An existing run already exists for this slot."
          : language === "fr"
            ? "Tournee creee."
            : "Run created.",
      );
    });
  };

  const postRunCommand = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, init);
    const payload = (await response.json().catch(() => ({}))) as {
      run?: DeliveryRunSummary;
      warning?: string;
      driverUrl?: string;
      error?: string;
    };
    if (!response.ok || !payload.run) {
      throw new Error(payload.error ?? "Unable to update run.");
    }
    applyRunUpdate(payload.run);
    if (payload.driverUrl) {
      setPublishedUrl(payload.driverUrl);
    }
    if (payload.warning) {
      setMessage(payload.warning);
    }
    return payload;
  };

  const moveStop = async (sourceStopId: string, targetStopId: string) => {
    if (!selectedRun || sourceStopId === targetStopId) return;
    const stops = [...selectedRun.stops];
    const sourceIndex = stops.findIndex((stop) => stop.id === sourceStopId);
    const targetIndex = stops.findIndex((stop) => stop.id === targetStopId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = stops.splice(sourceIndex, 1);
    stops.splice(targetIndex, 0, moved);

    await runAction(async () => {
      await postRunCommand(`/api/admin/delivery/runs/${selectedRun.id}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopIds: stops.map((stop) => stop.id) }),
      });
      setMessage(language === "fr" ? "Ordre mis a jour." : "Run order updated.");
    });
  };

  return (
    <section className="section delivery-runs-shell">
      <div className="delivery-runs-hero">
        <div>
          <h1>{language === "fr" ? "Tournées chauffeur" : "Driver runs"}</h1>
          <p className="small">
            {language === "fr"
              ? "Module parallele au planner actuel pour piloter les tournees, publier un lien chauffeur et capter une reference KM fiable."
              : "Parallel module to plan runs, publish driver links, and collect reliable distance references."}
          </p>
        </div>
        <div className="delivery-runs-flags">
          <span className={`badge ${featureEnabled ? "badge--ok" : "badge--warn"}`}>Runs {featureEnabled ? "ON" : "OFF"}</span>
          <span className={`badge ${gpsTrackingEnabled ? "badge--ok" : "badge--warn"}`}>GPS {gpsTrackingEnabled ? "ON" : "OFF"}</span>
          <span className={`badge ${googlePlanningReady ? "badge--ok" : "badge--warn"}`}>Google {googlePlanningReady ? "READY" : "PENDING"}</span>
        </div>
      </div>

      {!schemaAvailable ? <div className="admin-callout admin-callout--warn">Prisma n'a pas encore les tables DeliveryRun. Lance la migration avant d'utiliser cette page.</div> : null}
      {!featureEnabled ? <div className="admin-callout admin-callout--warn">Le module est desactive par flag. Rien n'impacte le site live tant que `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED=false`.</div> : null}
      {message ? <div className="admin-callout admin-callout--ok">{message}</div> : null}
      {error ? <div className="admin-callout admin-callout--err">{error}</div> : null}

      <div className="delivery-runs-grid">
        <aside className="delivery-runs-sidebar">
          <div className="admin-card">
            <h2>{language === "fr" ? "Creer un chauffeur" : "Create driver"}</h2>
            <input className="input" placeholder={language === "fr" ? "Nom du chauffeur" : "Driver name"} value={driverName} onChange={(event) => setDriverName(event.target.value)} />
            <input className="input" placeholder={language === "fr" ? "Telephone" : "Phone"} value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} />
            <button className="btn" onClick={() => void createDriver()} disabled={busy || !featureEnabled || !driverName.trim()}>Ajouter</button>
          </div>

          <div className="admin-card">
            <h2>{language === "fr" ? "Creer une tournee" : "Create run"}</h2>
            <label className="small">{language === "fr" ? "Date de consultation" : "View date"}</label>
            <input className="input" type="date" value={selectedDateKey} onChange={(event) => setSelectedDateKey(event.target.value)} />
            <label className="small">{language === "fr" ? "Creneau" : "Delivery slot"}</label>
            <select className="input" value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)}>
              {slotOptions.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatDateTime(slot.startAt, language)} - {slot.remainingCapacity}/{slot.capacity}
                </option>
              ))}
            </select>
            <label className="small">{language === "fr" ? "Chauffeur" : "Driver"}</label>
            <select className="input" value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)}>
              <option value="">{language === "fr" ? "Choisir" : "Choose"}</option>
              {activeDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </select>
            <label className="check"><input type="checkbox" checked={includeReturn} onChange={(event) => setIncludeReturn(event.target.checked)} /> {language === "fr" ? "Inclure le retour depot" : "Include depot return"}</label>
            <button className="btn" onClick={() => void createRun()} disabled={busy || !featureEnabled || !selectedSlotId || !selectedDriverId}>Creer la tournee</button>
            <button className="btn btn-secondary" onClick={() => void runAction(() => refreshRuns())} disabled={busy}>Rafraichir les tournees</button>
          </div>

          <div className="admin-card">
            <h2>{language === "fr" ? "Raccourcis" : "Shortcuts"}</h2>
            <a className="btn btn-secondary" href="/admin/delivery">{language === "fr" ? "Retour au planner historique" : "Open legacy planner"}</a>
            {publishedUrl ? <button className="btn btn-secondary" onClick={() => void navigator.clipboard.writeText(publishedUrl)}>{language === "fr" ? "Copier le dernier lien chauffeur" : "Copy last driver link"}</button> : null}
          </div>
        </aside>

        <div className="delivery-runs-main">
          <div className="admin-card">
            <div className="delivery-runs-list-header">
              <h2>{language === "fr" ? "Tournees du jour" : "Runs for the day"}</h2>
              <button className="btn btn-secondary" onClick={() => void runAction(() => refreshDrivers())} disabled={busy}>{language === "fr" ? "Rafraichir les chauffeurs" : "Refresh drivers"}</button>
            </div>

            <div className="delivery-runs-list">
              {runs.length === 0 ? <p className="small">{language === "fr" ? "Aucune tournee pour cette date." : "No delivery runs for this date."}</p> : null}
              {runs.map((run) => (
                <button key={run.id} className={`delivery-run-card ${selectedRun?.id === run.id ? "active" : ""}`} onClick={() => setSelectedRunId(run.id)}>
                  <div className="delivery-run-card__top">
                    <strong>{run.driver.name}</strong>
                    <span className="badge" style={{ backgroundColor: RUN_STATUS_COLORS[run.status] ?? "#334155" }}>{run.status}</span>
                  </div>
                  <div className="small">{formatDateTime(run.deliverySlot.startAt, language)}</div>
                  <div className="small">{run.stopCounts.total} stops · {formatDistance(run.actualKmFinal ?? run.plannedKm, language)}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedRun ? (
            <div className="admin-card delivery-run-detail">
              <div className="delivery-run-detail__header">
                <div>
                  <h2>{selectedRun.driver.name}</h2>
                  <p className="small">{formatDateTime(selectedRun.deliverySlot.startAt, language)} - {formatDateTime(selectedRun.deliverySlot.endAt, language)}</p>
                </div>
                <div className="delivery-run-detail__actions">
                  <button className="btn btn-secondary" onClick={() => void runAction(async () => { await postRunCommand(`/api/admin/delivery/runs/${selectedRun.id}/optimize`, { method: "POST" }); })} disabled={busy || !featureEnabled}>Optimiser</button>
                  <button className="btn btn-secondary" onClick={() => void runAction(async () => { const payload = await postRunCommand(`/api/admin/delivery/runs/${selectedRun.id}/publish`, { method: "POST" }); setMessage(payload.driverUrl ?? (language === "fr" ? "Lien publie." : "Driver link published.")); })} disabled={busy || !featureEnabled}>Publier</button>
                  <a className="btn btn-secondary" href={`/api/admin/delivery/runs/${selectedRun.id}?format=csv`}>CSV</a>
                </div>
              </div>

              <div className="delivery-run-metrics">
                <div><span className="small">Planned</span><strong>{formatDistance(selectedRun.plannedKm, language)}</strong></div>
                <div><span className="small">Actual</span><strong>{formatDistance(selectedRun.actualKmFinal, language)}</strong></div>
                <div><span className="small">Duration</span><strong>{formatDuration(selectedRun.plannedDurationSec, language)}</strong></div>
                <div><span className="small">Source</span><strong>{selectedRun.actualKmSource ?? "-"}</strong></div>
              </div>

              <div className="delivery-run-admin-complete">
                <input className="input" placeholder={language === "fr" ? "KM manuel admin" : "Manual admin KM"} value={manualActualKmFinal} onChange={(event) => setManualActualKmFinal(event.target.value)} />
                <button className="btn btn-secondary" onClick={() => void runAction(async () => { await postRunCommand(`/api/admin/delivery/runs/${selectedRun.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manualActualKmFinal: manualActualKmFinal ? Number(manualActualKmFinal) : undefined }) }); setMessage(language === "fr" ? "Tournee cloturee." : "Run completed."); })} disabled={busy || !featureEnabled}>Cloturer admin</button>
              </div>

              <div className="delivery-run-stop-list">
                {selectedRun.stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="delivery-run-stop"
                    draggable={featureEnabled}
                    onDragStart={() => setDragState({ runId: selectedRun.id, stopId: stop.id })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void (dragState?.runId === selectedRun.id ? moveStop(dragState.stopId, stop.id) : Promise.resolve())}
                  >
                    <div className="delivery-run-stop__head">
                      <strong>#{stop.finalSequence} · {stop.customerName}</strong>
                      <span className="badge">{stop.status}</span>
                    </div>
                    <div className="small">{stop.shippingLine1} · {stop.shippingPostal}</div>
                    <div className="small">{formatDistance(stop.plannedLegKm, language)} · {formatDistance(stop.actualCumulativeKmAtStop, language)}</div>
                    <div className="delivery-run-stop__links">
                      <a href={stop.mapsHref} target="_blank" rel="noreferrer">Maps</a>
                      {stop.deliveryPhone ? <a href={`tel:${stop.deliveryPhone.replace(/[^\d+]/g, "")}`}>{language === "fr" ? "Appeler" : "Call"}</a> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
