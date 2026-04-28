"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { Language } from "@/lib/i18n";
import type { DeliveryScheduleSettings } from "@/lib/types";

type DeliveryPeriodKey = "AM" | "PM";

type DeliverySlotRow = {
  id: string;
  startAt: string;
  endAt: string;
  periodKey: DeliveryPeriodKey;
  periodLabel: string;
  isOpen: boolean;
  note: string | null;
  dateKey: string;
  capacity: number;
  reservedCount: number;
  remainingCapacity: number;
  exception: {
    isClosed: boolean;
    capacityOverride: number | null;
    reason: string | null;
  } | null;
};

type SlotFormState = {
  id: string | null;
  startAt: string;
  endAt: string;
  capacity: string;
  isOpen: boolean;
  note: string;
};

type ExceptionFormState = {
  dateKey: string;
  isClosed: boolean;
  capacityOverride: string;
  reason: string;
};

type TodayDelivery = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  deliveryStatus: string;
  deliveryPhone: string | null;
  deliveryInstructions: string | null;
  shippingLine1: string | null;
  shippingCity: string | null;
  shippingPostal: string | null;
  deliverySlotId: string | null;
  deliveryWindowStartAt: string | null;
  deliveryWindowEndAt: string | null;
  dateKey: string | null;
  windowLabel: string;
};

type Props = {
  language: Language;
  initialSlots: DeliverySlotRow[];
  initialSettings: DeliveryScheduleSettings;
  initialActiveDriverCount: number;
  todayDeliveries?: TodayDelivery[];
};

type SettingsFormState = {
  averageDeliveryMinutes: string;
  blockMinutes: string;
  amEnabled: boolean;
  amStartTime: string;
  amEndTime: string;
  pmEnabled: boolean;
  pmStartTime: string;
  pmEndTime: string;
};

type TodaySortMode = "route" | "postal" | "customer" | "status";

type DeliveryUpdateResponse = {
  order?: {
    id: string;
    deliverySlotId: string | null;
    deliveryWindowStartAt: string | null;
    deliveryWindowEndAt: string | null;
    deliveryStatus: string;
    dateKey: string | null;
  };
  error?: string;
};

const DELIVERY_STATUS_LABELS_FR: Record<string, string> = {
  UNSCHEDULED: "Appel client requis",
  SCHEDULED: "Planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  FAILED: "Échouée",
  RESCHEDULED: "Replanifiée",
};

const DELIVERY_STATUS_LABELS_EN: Record<string, string> = {
  UNSCHEDULED: "Call customer",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RESCHEDULED: "Rescheduled",
};

const emptySlotForm: SlotFormState = {
  id: null,
  startAt: "",
  endAt: "",
  capacity: "8",
  isOpen: true,
  note: "",
};

const emptyExceptionForm: ExceptionFormState = {
  dateKey: "",
  isClosed: true,
  capacityOverride: "",
  reason: "",
};

const sortSlots = (rows: DeliverySlotRow[]) =>
  [...rows].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

const toDateKey = (value: Date) => {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const minutesToTimeInput = (minuteOfDay: number) => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const timeInputToMinutes = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":");
  return Number(hoursRaw) * 60 + Number(minutesRaw);
};

const settingsToForm = (settings: DeliveryScheduleSettings): SettingsFormState => ({
  averageDeliveryMinutes: String(settings.averageDeliveryMinutes),
  blockMinutes: String(settings.blockMinutes),
  amEnabled: settings.amEnabled,
  amStartTime: minutesToTimeInput(settings.amStartMinute),
  amEndTime: minutesToTimeInput(settings.amEndMinute),
  pmEnabled: settings.pmEnabled,
  pmStartTime: minutesToTimeInput(settings.pmStartMinute),
  pmEndTime: minutesToTimeInput(settings.pmEndMinute),
});

export function AdminDeliveryClient({
  language,
  initialSlots,
  initialSettings,
  initialActiveDriverCount,
  todayDeliveries = [],
}: Props) {
  const [slots, setSlots] = useState<DeliverySlotRow[]>(sortSlots(initialSlots));
  const [scheduleSettings, setScheduleSettings] = useState(initialSettings);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(() => settingsToForm(initialSettings));
  const [activeDriverCount, setActiveDriverCount] = useState(initialActiveDriverCount);
  const [todayRows, setTodayRows] = useState<TodayDelivery[]>(todayDeliveries);
  const [slotForm, setSlotForm] = useState<SlotFormState>(emptySlotForm);
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(emptyExceptionForm);
  const [slotLoading, setSlotLoading] = useState(false);
  const [exceptionLoading, setExceptionLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [deliveryUpdatingId, setDeliveryUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reçurringMode, setreçurringMode] = useState(false);
  const [reçurringCount, setreçurringCount] = useState(4);
  const [reçurringDays, setreçurringDays] = useState<number[]>([]);
  const [reçurringLoading, setreçurringLoading] = useState(false);
  const [todaySortMode, setTodaySortMode] = useState<TodaySortMode>("route");

  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const todayDateKey = toDateKey(new Date());
  const settingsCapacityPerBlock = Math.max(
    0,
    Math.floor(scheduleSettings.blockMinutes / scheduleSettings.averageDeliveryMinutes) * activeDriverCount,
  );

  const getDeliveryStatusLabel = useCallback(
    (status: string) =>
      (language === "fr" ? DELIVERY_STATUS_LABELS_FR : DELIVERY_STATUS_LABELS_EN)[status] ?? status,
    [language],
  );

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatWindowLabel = (startAt: string | null, endAt: string | null) => {
    if (!startAt || !endAt) return "-";
    return `${formatDateTime(startAt)} -> ${formatDateTime(endAt)}`;
  };

  const formatSlotOptionLabel = (slot: DeliverySlotRow) => {
    const availabilityLabel =
      language === "fr"
        ? `${slot.remainingCapacity} place(s) libres`
        : `${slot.remainingCapacity} spot(s) left`;
    return `${slot.periodLabel} · ${formatDateTime(slot.startAt)} -> ${formatDateTime(slot.endAt)} (${availabilityLabel})`;
  };

  const submitreçurring = async () => {
    if (!slotForm.startAt || !slotForm.endAt || reçurringDays.length === 0) return;

    setreçurringLoading(true);
    setMessage("");
    setError("");

    try {
      const baseStart = new Date(slotForm.startAt);
      const baseEnd = new Date(slotForm.endAt);
      const duration = baseEnd.getTime() - baseStart.getTime();

      let created = 0;
      let skipped = 0;

      for (let week = 0; week < reçurringCount; week++) {
        for (const dayOfWeek of [...reçurringDays].sort((a, b) => a - b)) {
          const currentDate = new Date(baseStart);
          const daysToAdd = (dayOfWeek - currentDate.getDay() + 7) % 7 + (week * 7);
          
          currentDate.setDate(currentDate.getDate() + daysToAdd);
          const endDate = new Date(currentDate.getTime() + duration);

          const payload = {
            startAt: currentDate.toISOString(),
            endAt: endDate.toISOString(),
            capacity: Number(slotForm.capacity),
            isOpen: slotForm.isOpen,
            note: slotForm.note.trim() || undefined,
          };

          const res = await fetch("/api/admin/delivery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) created++;
          else skipped++;
        }
      }

      setMessage(language === "fr"
        ? `${created} créneaux créés. ${skipped > 0 ? `${skipped} ignorés (chevauchement).` : ""}`
        : `${created} slots created. ${skipped > 0 ? `${skipped} skipped (overlap).` : ""}`
      );

      setreçurringMode(false);
      await refreshSlots();

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setreçurringLoading(false);
    }
  };

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DeliverySlotRow[]>();
    for (const slot of slots) {
      const arr = map.get(slot.dateKey) ?? [];
      arr.push(slot);
      map.set(slot.dateKey, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const visibleSlotsCount = useMemo(
    () =>
      slots.filter((slot) => {
        const closedByException = slot.exception?.isClosed ?? false;
        return slot.isOpen && !closedByException && slot.remainingCapacity > 0 && new Date(slot.endAt) > new Date();
      }).length,
    [slots],
  );

  const todayStats = useMemo(
    () => ({
      total: todayRows.length,
      scheduled: todayRows.filter((row) => row.deliveryStatus === "SCHEDULED").length,
      outForDelivery: todayRows.filter((row) => row.deliveryStatus === "OUT_FOR_DELIVERY").length,
      delivered: todayRows.filter((row) => row.deliveryStatus === "DELIVERED").length,
      attention: todayRows.filter((row) => row.deliveryStatus === "FAILED" || row.deliveryStatus === "RESCHEDULED").length,
    }),
    [todayRows],
  );

  const routeSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of todayRows) {
      map.set(row.windowLabel, (map.get(row.windowLabel) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([windowLabel, count]) => ({ windowLabel, count }));
  }, [todayRows]);

  const routeRows = useMemo(() => {
    const rows = [...todayRows];
    rows.sort((a, b) => {
      if (todaySortMode === "customer") {
        return `${a.customerName} ${a.customerEmail}`.localeCompare(`${b.customerName} ${b.customerEmail}`);
      }

      if (todaySortMode === "postal") {
        const postalDiff = (a.shippingPostal ?? "ZZZ").localeCompare(b.shippingPostal ?? "ZZZ");
        if (postalDiff !== 0) return postalDiff;
        return (a.shippingLine1 ?? "ZZZ").localeCompare(b.shippingLine1 ?? "ZZZ");
      }

      if (todaySortMode === "status") {
        const statusDiff = getDeliveryStatusLabel(a.deliveryStatus).localeCompare(
          getDeliveryStatusLabel(b.deliveryStatus),
        );
        if (statusDiff !== 0) return statusDiff;
      }

      const startDiff = (a.deliveryWindowStartAt ?? "").localeCompare(b.deliveryWindowStartAt ?? "");
      if (startDiff !== 0) return startDiff;

      const postalDiff = (a.shippingPostal ?? "ZZZ").localeCompare(b.shippingPostal ?? "ZZZ");
      if (postalDiff !== 0) return postalDiff;

      const addressDiff = (a.shippingLine1 ?? "ZZZ").localeCompare(b.shippingLine1 ?? "ZZZ");
      if (addressDiff !== 0) return addressDiff;

      return a.customerName.localeCompare(b.customerName);
    });
    return rows;
  }, [getDeliveryStatusLabel, todayRows, todaySortMode]);

  const futureSlots = useMemo(
    () =>
      slots.filter((slot) => {
        const closedByException = slot.exception?.isClosed ?? false;
        return slot.isOpen && !closedByException && new Date(slot.endAt) > new Date();
      }),
    [slots],
  );

  const getRescheduleOptions = (row: TodayDelivery) =>
    futureSlots.filter((slot) => slot.id === row.deliverySlotId || slot.remainingCapacity > 0);

  const printRouteSheet = () => {
    window.print();
  };

  const resetSlotForm = () => setSlotForm(emptySlotForm);

  const upsertSlotInState = (slot: DeliverySlotRow) => {
    setSlots((current) => sortSlots([slot, ...current.filter((s) => s.id !== slot.id)]));
  };

  const refreshSlots = async () => {
    const res = await fetch("/api/admin/delivery");
    const data = (await res.json().catch(() => ({}))) as { slots?: DeliverySlotRow[]; error?: string };
    if (!res.ok || !data.slots) {
      throw new Error(data.error ?? "Unable to refresh delivery slots");
    }
    setSlots(sortSlots(data.slots));
  };

  const submitSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsLoading(true);
    setMessage("");
    setError("");

    const payload = {
      averageDeliveryMinutes: Number(settingsForm.averageDeliveryMinutes),
      blockMinutes: Number(settingsForm.blockMinutes),
      amEnabled: settingsForm.amEnabled,
      amStartMinute: timeInputToMinutes(settingsForm.amStartTime),
      amEndMinute: timeInputToMinutes(settingsForm.amEndTime),
      pmEnabled: settingsForm.pmEnabled,
      pmStartMinute: timeInputToMinutes(settingsForm.pmStartTime),
      pmEndMinute: timeInputToMinutes(settingsForm.pmEndTime),
    };

    try {
      const res = await fetch("/api/admin/delivery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        settings?: DeliveryScheduleSettings;
        activeDriverCount?: number;
        error?: string;
      };

      if (!res.ok || !data.settings) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible d'enregistrer les réglages."
              : "Unable to save schedule settings."),
        );
        return;
      }

      setScheduleSettings(data.settings);
      setSettingsForm(settingsToForm(data.settings));
      setActiveDriverCount(data.activeDriverCount ?? activeDriverCount);
      setMessage(language === "fr" ? "Réglages de planification mis à jour." : "Schedule settings updated.");
      await refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSettingsLoading(false);
    }
  };

  const submitSlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSlotLoading(true);
    setMessage("");
    setError("");

    const payload = {
      ...(slotForm.id ? { id: slotForm.id } : {}),
      startAt: new Date(slotForm.startAt).toISOString(),
      endAt: new Date(slotForm.endAt).toISOString(),
      capacity: Number(slotForm.capacity),
      isOpen: slotForm.isOpen,
      note: slotForm.note.trim() || undefined,
    };

    try {
      const res = await fetch("/api/admin/delivery", {
        method: slotForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        slot?: DeliverySlotRow;
      };

      if (!res.ok || !data.slot) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible d'enregistrer le créneau."
              : "Unable to save delivery slot."),
        );
        return;
      }

      upsertSlotInState(data.slot);
      setMessage(
        slotForm.id
          ? language === "fr"
            ? "Créneau mis à jour."
            : "Slot updated."
          : language === "fr"
            ? "Créneau ajouté."
            : "Slot created.",
      );
      resetSlotForm();
      await refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSlotLoading(false);
    }
  };

  const editSlot = (slot: DeliverySlotRow) => {
    setSlotForm({
      id: slot.id,
      startAt: slot.startAt.slice(0, 16),
      endAt: slot.endAt.slice(0, 16),
      capacity: String(slot.capacity),
      isOpen: slot.isOpen,
      note: slot.note ?? "",
    });
    setMessage("");
    setError("");
  };

  const removeSlot = async (slot: DeliverySlotRow) => {
    const confirmed = window.confirm(
      language === "fr"
        ? `Supprimer ce créneau (${formatDateTime(slot.startAt)}) ?`
        : `Delete this slot (${formatDateTime(slot.startAt)})?`,
    );
    if (!confirmed) return;

    setDeleteLoadingId(slot.id);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/delivery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slot.id }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible de supprimer le créneau."
              : "Unable to delete slot."),
        );
        return;
      }

      setSlots((current) => current.filter((s) => s.id !== slot.id));
      if (slotForm.id === slot.id) resetSlotForm();
      setMessage(language === "fr" ? "Créneau supprimé." : "Slot deleted.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const submitException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExceptionLoading(true);
    setMessage("");
    setError("");

    const payload = {
      dateKey: exceptionForm.dateKey,
      isClosed: exceptionForm.isClosed,
      capacityOverride: exceptionForm.capacityOverride.trim()
        ? Number(exceptionForm.capacityOverride)
        : null,
      reason: exceptionForm.reason.trim() || undefined,
    };

    try {
      const res = await fetch("/api/admin/delivery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible d'enregistrer l'exception."
              : "Unable to save exception."),
        );
        return;
      }

      setMessage(language === "fr" ? "Exception enregistrée." : "Exception saved.");
      setExceptionForm(emptyExceptionForm);
      await refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setExceptionLoading(false);
    }
  };

  const deleteException = async (dateKey: string) => {
    const confirmed = window.confirm(
      language === "fr"
        ? `Supprimer l'exception du ${dateKey} ?`
        : `Delete exception for ${dateKey}?`,
    );
    if (!confirmed) return;

    setMessage("");
    setError("");

    const res = await fetch("/api/admin/delivery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateKey }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? (language === "fr" ? "Suppression impossible." : "Delete failed."));
      return;
    }

    setMessage(language === "fr" ? "Exception supprimee." : "Exception deleted.");
    await refreshSlots();
  };

  const updateTodayDeliveryStatus = async (orderId: string, deliveryStatus: string) => {
    setDeliveryUpdatingId(orderId);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, deliveryStatus }),
      });

      const data = (await res.json().catch(() => ({}))) as DeliveryUpdateResponse;
      if (!res.ok) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible de mettre à jour le statut de livraison."
              : "Unable to update delivery status."),
        );
        return;
      }

      setTodayRows((current) =>
        current.map((row) => (row.id === orderId ? { ...row, deliveryStatus } : row)),
      );
      setMessage(language === "fr" ? "Statut de livraison mis à jour." : "Delivery status updated.");
    } finally {
      setDeliveryUpdatingId(null);
    }
  };

  const rescheduleTodayDelivery = async (row: TodayDelivery, nextSlotId: string | null) => {
    if (nextSlotId === row.deliverySlotId) return;

    setDeliveryUpdatingId(row.id);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: row.id, deliverySlotId: nextSlotId }),
      });

      const data = (await res.json().catch(() => ({}))) as DeliveryUpdateResponse;
      if (!res.ok || !data.order) {
        setError(
          data.error ??
            (language === "fr" ? "Impossible de replanifier la livraison." : "Unable to reschedule delivery."),
        );
        return;
      }

      const nextOrder = data.order;
      const movedOffToday = !nextOrder.dateKey || nextOrder.dateKey !== todayDateKey;

      setTodayRows((current) => {
        if (movedOffToday || !nextOrder.deliveryWindowStartAt || !nextOrder.deliveryWindowEndAt) {
          return current.filter((item) => item.id !== row.id);
        }

        return current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                deliverySlotId: nextOrder.deliverySlotId,
                deliveryWindowStartAt: nextOrder.deliveryWindowStartAt,
                deliveryWindowEndAt: nextOrder.deliveryWindowEndAt,
                dateKey: nextOrder.dateKey,
                windowLabel: formatWindowLabel(nextOrder.deliveryWindowStartAt, nextOrder.deliveryWindowEndAt),
                deliveryStatus: nextOrder.deliveryStatus,
              }
            : item,
        );
      });

      setMessage(
        movedOffToday
          ? language === "fr"
            ? "Livraison replanifiée hors de la tournée du jour."
            : "Delivery rescheduled outside today's route."
          : language === "fr"
            ? "Livraison replanifiée."
            : "Delivery rescheduled.",
      );
      await refreshSlots();
    } finally {
      setDeliveryUpdatingId(null);
    }
  };

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Gestion des livraisons" : "Delivery management"}</h1>
        <p className="small">
          {language === "fr"
            ? "Créer des créneaux, ajuste les capacités et gère la tournée du jour."
            : "Create slots, adjust capacities and apply day-level exceptions."}
        </p>
        {message ? <p className="ok small">{message}</p> : null}
        {error ? <p className="err small">{error}</p> : null}
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "Créneaux ouverts" : "Open slots"}</div>
            <strong>{visibleSlotsCount}</strong>
          </div>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "Livraisons du jour" : "Today's deliveries"}</div>
            <strong>{todayStats.total}</strong>
          </div>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "Planifiées" : "Scheduled"}</div>
            <strong>{todayStats.scheduled}</strong>
          </div>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "En tournée" : "Out for delivery"}</div>
            <strong>{todayStats.outForDelivery}</strong>
          </div>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "Livrées" : "Delivered"}</div>
            <strong>{todayStats.delivered}</strong>
          </div>
          <div className="card" style={{ padding: 12, minWidth: 120 }}>
            <div className="small">{language === "fr" ? "A surveiller" : "Need attention"}</div>
            <strong>{todayStats.attention}</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2>{language === "fr" ? "Réglages de planification" : "Schedule settings"}</h2>
            <p className="small" style={{ marginTop: 4 }}>
              {language === "fr"
                ? `${activeDriverCount} chauffeur(s) actif(s), ${settingsCapacityPerBlock} place(s) par bloc interne.`
                : `${activeDriverCount} active driver(s), ${settingsCapacityPerBlock} spot(s) per internal block.`}
            </p>
            {activeDriverCount <= 0 ? (
              <p className="err small" style={{ marginTop: 6 }}>
                {language === "fr"
                  ? "Aucun chauffeur actif: aucune capacité automatique ne sera ouverte."
                  : "No active driver: automatic capacity is closed."}
              </p>
            ) : null}
          </div>
        </div>

        <form onSubmit={submitSettings} className="card" style={{ padding: 14, marginTop: 12 }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label className="field">
              <span>{language === "fr" ? "Minutes par livraison" : "Minutes per delivery"}</span>
              <input
                className="input"
                type="number"
                min={5}
                max={240}
                value={settingsForm.averageDeliveryMinutes}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, averageDeliveryMinutes: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{language === "fr" ? "Bloc interne" : "Internal block"}</span>
              <input
                className="input"
                type="number"
                min={15}
                max={480}
                value={settingsForm.blockMinutes}
                onChange={(event) => setSettingsForm((current) => ({ ...current, blockMinutes: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>AM</span>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={settingsForm.amEnabled}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, amEnabled: event.target.checked }))}
                />
                <input
                  className="input"
                  type="time"
                  value={settingsForm.amStartTime}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, amStartTime: event.target.value }))}
                />
                <input
                  className="input"
                  type="time"
                  value={settingsForm.amEndTime}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, amEndTime: event.target.value }))}
                />
              </div>
            </label>
            <label className="field">
              <span>PM</span>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={settingsForm.pmEnabled}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, pmEnabled: event.target.checked }))}
                />
                <input
                  className="input"
                  type="time"
                  value={settingsForm.pmStartTime}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, pmStartTime: event.target.value }))}
                />
                <input
                  className="input"
                  type="time"
                  value={settingsForm.pmEndTime}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, pmEndTime: event.target.value }))}
                />
              </div>
            </label>
          </div>
          <button className="btn" type="submit" disabled={settingsLoading} style={{ marginTop: 12 }}>
            {settingsLoading
              ? language === "fr"
                ? "Enregistrement..."
                : "Saving..."
              : language === "fr"
                ? "Enregistrer les réglages"
                : "Save settings"}
          </button>
        </form>
      </section>

      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2>{language === "fr" ? "Tournee du jour" : "Today's route"}</h2>
            <p className="small" style={{ marginTop: 4 }}>
              {language === "fr"
                ? "Vue opérationnelle pour organiser la tournée et ajuster les livraisons."
                : "Operational view to organize the route and adjust deliveries."}
            </p>
          </div>
          <label className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <span>{language === "fr" ? "Trier par" : "Sort by"}</span>
            <select
              className="select"
              value={todaySortMode}
              onChange={(event) => setTodaySortMode(event.target.value as TodaySortMode)}
            >
              <option value="route">{language === "fr" ? "Ordre de passage" : "Route order"}</option>
              <option value="postal">{language === "fr" ? "Code postal" : "Postal code"}</option>
              <option value="customer">{language === "fr" ? "Client" : "Customer"}</option>
              <option value="status">{language === "fr" ? "Statut" : "Status"}</option>
            </select>
          </label>
          <button className="btn btn-secondary route-print-trigger" type="button" onClick={printRouteSheet}>
            {language === "fr" ? "Imprimer la feuille de route" : "Print route sheet"}
          </button>
        </div>

        {routeSummary.length > 0 ? (
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {routeSummary.map((item) => (
              <div key={item.windowLabel} className="card" style={{ padding: 12, minWidth: 180 }}>
                <div className="small">{item.windowLabel}</div>
                <strong>
                  {item.count} {language === "fr" ? "arret(s)" : "stop(s)"}
                </strong>
              </div>
            ))}
          </div>
        ) : null}

        {routeRows.length > 0 ? (
          <div className="route-print-sheet" style={{ display: "none" }}>
            <div className="route-print-sheet__header">
              <h3 style={{ marginBottom: 4 }}>
                {language === "fr" ? "Feuille de tournée" : "Route sheet"}
              </h3>
              <p className="small" style={{ marginTop: 0 }}>
                {language === "fr"
                  ? `Total: ${routeRows.length} arret(s)`
                  : `Total: ${routeRows.length} stop(s)`}
              </p>
            </div>

            <div className="route-print-sheet__summary">
              {routeSummary.map((item) => (
                <div key={item.windowLabel} className="route-print-sheet__summary-card">
                  <strong>{item.windowLabel}</strong>
                  <span>
                    {item.count} {language === "fr" ? "arret(s)" : "stop(s)"}
                  </span>
                </div>
              ))}
            </div>

            <div className="route-print-sheet__list">
              {routeRows.map((row, index) => (
                <article key={row.id} className="route-print-stop">
                  <div className="route-print-stop__top">
                    <div className="route-print-stop__check" />
                    <div className="route-print-stop__identity">
                      <strong>
                        {index + 1}. {row.customerName}
                      </strong>
                      <span>{row.orderNumber}</span>
                    </div>
                    <div className="route-print-stop__window">{row.windowLabel}</div>
                  </div>

                  <div className="route-print-stop__grid">
                    <div>
                      <div className="small">{language === "fr" ? "Adresse" : "Address"}</div>
                      <div>{row.shippingLine1 ?? "-"}</div>
                      <div>{[row.shippingCity, row.shippingPostal].filter(Boolean).join(", ") || "-"}</div>
                    </div>
                    <div>
                      <div className="small">{language === "fr" ? "Telephone" : "Phone"}</div>
                      <div>{row.deliveryPhone ?? "-"}</div>
                      <div>{row.customerEmail}</div>
                    </div>
                    <div>
                      <div className="small">{language === "fr" ? "Consignes" : "Instructions"}</div>
                      <div>{row.deliveryInstructions ?? "-"}</div>
                    </div>
                  </div>

                  <div className="route-print-stop__footer">
                    <span>{language === "fr" ? "Livrée" : "Delivered"}</span>
                    <span>{language === "fr" ? "Absente" : "No answer"}</span>
                    <span>{language === "fr" ? "Paiement/verif." : "Payment/check"}</span>
                  </div>

                  <div className="route-print-stop__notes">
                    <div className="small">{language === "fr" ? "Notes de passage" : "Driver notes"}</div>
                    <div className="route-print-stop__note-lines" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {routeRows.length === 0 ? (
          <p className="small">
            {language === "fr" ? "Aucune livraison planifiée pour aujourd'hui." : "No deliveries scheduled for today."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{language === "fr" ? "Commande" : "Order"}</th>
                  <th>{language === "fr" ? "Créneau" : "Window"}</th>
                  <th>{language === "fr" ? "Client" : "Customer"}</th>
                  <th>{language === "fr" ? "Adresse" : "Address"}</th>
                  <th>{language === "fr" ? "Contact" : "Contact"}</th>
                  <th>{language === "fr" ? "Statut" : "Status"}</th>
                  <th>{language === "fr" ? "Replanifier" : "Reschedule"}</th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map((row, index) => {
                  const slotOptions = getRescheduleOptions(row);
                  const isBusy = deliveryUpdatingId === row.id;

                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{index + 1}</strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{row.orderNumber}</strong>
                          <span className="small">{getDeliveryStatusLabel(row.deliveryStatus)}</span>
                        </div>
                      </td>
                      <td className="small">{row.windowLabel}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{row.customerName}</strong>
                          <span className="small">{row.customerEmail}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{row.shippingLine1 ?? "-"}</span>
                          <span className="small">{[row.shippingCity, row.shippingPostal].filter(Boolean).join(", ") || "-"}</span>
                          <span className="small">{row.deliveryInstructions ?? "-"}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{row.deliveryPhone ?? "-"}</span>
                          <span className="small">{row.customerEmail}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={row.deliveryStatus}
                          disabled={isBusy}
                          onChange={(event) => void updateTodayDeliveryStatus(row.id, event.target.value)}
                          style={{ minWidth: 180, opacity: isBusy ? 0.6 : 1 }}
                        >
                          {Object.keys(DELIVERY_STATUS_LABELS_FR).map((status) => (
                            <option key={status} value={status}>
                              {getDeliveryStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={row.deliverySlotId ?? ""}
                          disabled={isBusy}
                          onChange={(event) => void rescheduleTodayDelivery(row, event.target.value.trim() || null)}
                          style={{ minWidth: 260, opacity: isBusy ? 0.6 : 1 }}
                        >
                          <option value="">{language === "fr" ? "Retirer du planning" : "Clear schedule"}</option>
                          {slotOptions.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {formatSlotOptionLabel(slot)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>{slotForm.id ? (language === "fr" ? "Modifier un créneau" : "Edit slot") : (language === "fr" ? "Ajouter un créneau" : "Add slot")}</h2>
        <form className="two-col" onSubmit={submitSlot}>
          <div className="field">
            <label>{language === "fr" ? "Debut" : "Start"}</label>
            <input
              className="input"
              type="datetime-local"
              value={slotForm.startAt}
              onChange={(e) => setSlotForm((c) => ({ ...c, startAt: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Fin" : "End"}</label>
            <input
              className="input"
              type="datetime-local"
              value={slotForm.endAt}
              onChange={(e) => setSlotForm((c) => ({ ...c, endAt: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Capacite" : "Capacity"}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={slotForm.capacity}
              onChange={(e) => setSlotForm((c) => ({ ...c, capacity: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Ouvert" : "Open"}</label>
            <select
              className="select"
              value={slotForm.isOpen ? "yes" : "no"}
              onChange={(e) => setSlotForm((c) => ({ ...c, isOpen: e.target.value === "yes" }))}
            >
              <option value="yes">{language === "fr" ? "Oui" : "Yes"}</option>
              <option value="no">{language === "fr" ? "Non" : "No"}</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>{language === "fr" ? "Note" : "Note"}</label>
            <input
              className="input"
              value={slotForm.note}
              onChange={(e) => setSlotForm((c) => ({ ...c, note: e.target.value }))}
              placeholder={language === "fr" ? "Ex: Livreur nord" : "e.g. North route"}
            />
          </div>
          <div className="row" style={{ gridColumn: "1 / -1", gap: 8 }}>
            <button className="btn" type="submit" disabled={slotLoading}>
              {slotLoading
                ? language === "fr"
                  ? "Enregistrement..."
                  : "Saving..."
                : slotForm.id
                  ? language === "fr"
                    ? "Mettre à jour"
                    : "Update"
                  : language === "fr"
                    ? "Ajouter"
                    : "Create"}
            </button>
            {slotForm.id ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={resetSlotForm}
              >
                {language === "fr" ? "annulér" : "Cancel"}
              </button>
            ) : null}
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => setreçurringMode(!reçurringMode)}
              style={{ width: "100%" }}
            >
              {reçurringMode 
                ? (language === "fr" ? "annulér creation multiple" : "Cancel multiple creation")
                : (language === "fr" ? "Créer plusieurs créneaux récurrents" : "Create multiple recurring slots")}
            </button>
          </div>

          {reçurringMode && (
            <>
              <div className="field">
                <label>{language === "fr" ? "Jours de la semaine" : "Days of week"}</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        backgroundColor: reçurringDays.includes(i) ? "#16a34a" : "white",
                        color: reçurringDays.includes(i) ? "white" : "inherit",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        setreçurringDays(prev => 
                          prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                        );
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="field">
                <label>{language === "fr" ? "Nombre de semaines" : "Number of weeks"}</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={12}
                  value={reçurringCount}
                  onChange={(e) => setreçurringCount(Number(e.target.value))}
                />
              </div>
              
              <div className="row" style={{ gridColumn: "1 / -1", gap: 8 }}>
                <button 
                  className="btn" 
                  type="button" 
                  onClick={submitreçurring}
                  disabled={reçurringLoading || reçurringDays.length === 0}
                >
                  {reçurringLoading 
                    ? (language === "fr" ? "Creation en cours..." : "Creating slots...")
                    : (language === "fr" ? "Générer tous les créneaux" : "Generate all slots")}
                </button>
              </div>
            </>
          )}
        </form>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Exception journaliere" : "Day exception"}</h2>
        <form className="two-col" onSubmit={submitException}>
          <div className="field">
            <label>{language === "fr" ? "Date" : "Date"}</label>
            <input
              className="input"
              type="date"
              value={exceptionForm.dateKey}
              onChange={(e) => setExceptionForm((c) => ({ ...c, dateKey: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Fermer la date" : "Close date"}</label>
            <select
              className="select"
              value={exceptionForm.isClosed ? "yes" : "no"}
              onChange={(e) => setExceptionForm((c) => ({ ...c, isClosed: e.target.value === "yes" }))}
            >
              <option value="yes">{language === "fr" ? "Oui" : "Yes"}</option>
              <option value="no">{language === "fr" ? "Non" : "No"}</option>
            </select>
          </div>
          <div className="field">
            <label>{language === "fr" ? "Capacite (optionnel)" : "Capacity (optional)"}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={exceptionForm.capacityOverride}
              onChange={(e) => setExceptionForm((c) => ({ ...c, capacityOverride: e.target.value }))}
              placeholder={language === "fr" ? "Laisser vide pour ne pas changer" : "Leave blank to keep default"}
            />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Raison" : "Reason"}</label>
            <input
              className="input"
              value={exceptionForm.reason}
              onChange={(e) => setExceptionForm((c) => ({ ...c, reason: e.target.value }))}
              placeholder={language === "fr" ? "Ex: Jour ferie" : "e.g. Holiday"}
            />
          </div>
          <div className="row" style={{ gridColumn: "1 / -1", gap: 8 }}>
            <button className="btn" type="submit" disabled={exceptionLoading}>
              {exceptionLoading
                ? language === "fr"
                  ? "Enregistrement..."
                  : "Saving..."
                : language === "fr"
                  ? "Enregistrer l'exception"
                  : "Save exception"}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Créneaux planifiés" : "Scheduled slots"}</h2>
        {slotsByDate.length === 0 ? (
          <p className="small">{language === "fr" ? "Aucun créneau pour l'instant." : "No slots yet."}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === "fr" ? "Date" : "Date"}</th>
                  <th>{language === "fr" ? "Créneau" : "Slot"}</th>
                  <th>{language === "fr" ? "Visibilite client" : "Customer visibility"}</th>
                  <th>{language === "fr" ? "Capacite" : "Capacity"}</th>
                  <th>{language === "fr" ? "Reserve" : "Reserved"}</th>
                  <th>{language === "fr" ? "Exception" : "Exception"}</th>
                  <th>{language === "fr" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {slotsByDate.map(([dateKey, group]) =>
                  group.map((slot, index) => (
                    <tr key={slot.id}>
                      <td>
                        {index === 0 ? dateKey : ""}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <strong>{slot.periodLabel}</strong>
                          <span>{formatDateTime(slot.startAt)}{" -> "}{formatDateTime(slot.endAt)}</span>
                          <span className="small">{slot.isOpen ? (language === "fr" ? "Ouvert" : "Open") : (language === "fr" ? "Ferme" : "Closed")}</span>
                          {slot.note ? <span className="small">Note: {slot.note}</span> : null}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const closedByException = slot.exception?.isClosed ?? false;
                          const isPast = new Date(slot.endAt) <= new Date();
                          let label = language === "fr" ? "Visible" : "Visible";
                          let color = "#16a34a";

                          if (isPast) {
                            label = language === "fr" ? "Passe" : "Past";
                            color = "#6b7280";
                          } else if (closedByException || !slot.isOpen) {
                            label = language === "fr" ? "Masque" : "Hidden";
                            color = "#dc2626";
                          } else if (slot.remainingCapacity <= 0) {
                            label = language === "fr" ? "Complet" : "Full";
                            color = "#d97706";
                          }

                          return <span style={{ color, fontWeight: 600 }}>{label}</span>;
                        })()}
                      </td>
                      <td>{slot.capacity}</td>
                      <td>
                         <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                           <span>{slot.reservedCount} / {slot.capacity}</span>
                           <div style={{ 
                             height: 6, 
                             borderRadius: 3, 
                             backgroundColor: "#e5e5e5",
                             overflow: "hidden"
                           }}>
                             <div style={{
                               height: "100%",
                               width: `${slot.capacity > 0 ? Math.min(100, (slot.reservedCount / slot.capacity) * 100) : 0}%`,
                               backgroundColor: 
                                 slot.capacity > 0 && (slot.reservedCount / slot.capacity) >= 0.9 ? "#dc2626" :
                                 slot.capacity > 0 && (slot.reservedCount / slot.capacity) >= 0.7 ? "#d97706" : "#16a34a"
                             }} />
                           </div>
                         </div>
                       </td>
                      <td>
                        {slot.exception ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className="small">
                              {slot.exception.isClosed
                                ? (language === "fr" ? "Ferme" : "Closed")
                                : (language === "fr" ? "Ouvert" : "Open")}
                            </span>
                            {slot.exception.capacityOverride != null ? (
                              <span className="small">{language === "fr" ? "Capacite" : "Capacity"}: {slot.exception.capacityOverride}</span>
                            ) : null}
                            {slot.exception.reason ? <span className="small">{slot.exception.reason}</span> : null}
                            <button
                              className="btn btn-secondary"
                              type="button"
                              style={{ marginTop: 4 }}
                              onClick={() => void deleteException(slot.dateKey)}
                            >
                              {language === "fr" ? "Retirer" : "Remove"}
                            </button>
                          </div>
                        ) : (
                          <span className="small">-</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                           <button className="btn btn-secondary" type="button" onClick={() => editSlot(slot)}>
                             {language === "fr" ? "Modifier" : "Edit"}
                           </button>
                           <button className="btn btn-secondary" type="button" onClick={() => {
                             const currentDate = new Date(slot.startAt);
                             const nextDate = new Date(currentDate);
                             nextDate.setDate(nextDate.getDate() + 1);
                             
                             setSlotForm({
                               id: null,
                               startAt: nextDate.toISOString().slice(0, 16),
                               endAt: (() => {
                                 const end = new Date(slot.endAt);
                                 end.setDate(end.getDate() + 1);
                                 return end.toISOString().slice(0, 16);
                               })(),
                               capacity: String(slot.capacity),
                               isOpen: slot.isOpen,
                               note: slot.note ?? "",
                             });
                             setMessage("");
                             setError("");
                             window.scrollTo({ top: 0, behavior: 'smooth' });
                           }}>
                             {language === "fr" ? "Dupliquer" : "Duplicate"}
                           </button>
                           <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={deleteLoadingId === slot.id}
                            onClick={() => void removeSlot(slot)}
                          >
                            {deleteLoadingId === slot.id
                              ? language === "fr"
                                ? "Suppression..."
                                : "Deleting..."
                              : language === "fr"
                                ? "Supprimer"
                                : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <style>{`
        @media print {
          .route-print-sheet {
            display: block !important;
            margin-top: 20px;
          }

          .route-print-sheet__summary {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin: 12px 0 18px;
          }

          .route-print-sheet__summary-card {
            border: 1px solid #d4d4d4;
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .route-print-sheet__list {
            display: grid;
            gap: 16px;
          }

          .route-print-stop {
            border: 1px solid #111827;
            padding: 12px;
            break-inside: avoid;
          }

          .route-print-stop__top {
            display: grid;
            grid-template-columns: 28px 1fr auto;
            gap: 10px;
            align-items: start;
            margin-bottom: 10px;
          }

          .route-print-stop__check {
            width: 18px;
            height: 18px;
            border: 2px solid #111827;
            margin-top: 3px;
          }

          .route-print-stop__identity {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .route-print-stop__window {
            font-weight: 700;
            text-align: right;
          }

          .route-print-stop__grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 10px;
          }

          .route-print-stop__footer {
            display: flex;
            gap: 18px;
            margin-bottom: 10px;
            font-size: 12px;
          }

          .route-print-stop__footer span::before {
            content: "";
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 1px solid #111827;
            margin-right: 6px;
            vertical-align: -1px;
          }

          .route-print-stop__notes {
            display: grid;
            gap: 6px;
          }

          .route-print-stop__note-lines {
            min-height: 54px;
            background-image: linear-gradient(to bottom, transparent 0, transparent 17px, #d4d4d4 17px, #d4d4d4 18px);
            background-size: 100% 18px;
          }

          .route-print-trigger,
          form,
          .btn,
          .topbar,
          .checkout-page-header,
          .table-wrap,
          .row > .card {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .section {
            box-shadow: none !important;
            border: 1px solid #d4d4d4 !important;
            break-inside: avoid;
          }

          .small {
            color: #4b5563 !important;
          }
        }
      `}</style>
    </>
  );
}



