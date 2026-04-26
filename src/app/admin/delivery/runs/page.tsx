import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminDeliveryRunSlots } from "@/lib/delivery";
import {
  isDeliveryGpsTrackingEnabled,
  isDeliveryRunsEnabled,
  isDeliveryRunsSchemaAvailable,
  isGoogleRoutePlanningReady,
  listDeliveryDrivers,
  listDeliveryRunsByDate,
} from "@/lib/delivery-runs";
import { AdminDeliveryRunsClient } from "./runs-client";

export default async function AdminDeliveryRunsPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{language === "fr" ? "Tournées chauffeur" : "Driver runs"}</h1>
        <p className="small">
          {language === "fr" ? "Acces reserve aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  const today = new Date();
  const from = new Date(today);
  from.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(today.getDate() + 14);
  to.setHours(23, 59, 59, 999);
  const todayKey = today.toISOString().slice(0, 10);

  const featureEnabled = isDeliveryRunsEnabled();
  const gpsTrackingEnabled = isDeliveryGpsTrackingEnabled();
  const googlePlanningReady = isGoogleRoutePlanningReady();
  const schemaAvailable = await isDeliveryRunsSchemaAvailable();

  const [slots, drivers, runs] =
    featureEnabled && schemaAvailable
      ? await Promise.all([
          getAdminDeliveryRunSlots({ from, to }),
          listDeliveryDrivers(),
          listDeliveryRunsByDate(todayKey),
        ])
      : [await getAdminDeliveryRunSlots({ from, to }), [], []];

  return (
    <AdminDeliveryRunsClient
      language={language}
      featureEnabled={featureEnabled}
      gpsTrackingEnabled={gpsTrackingEnabled}
      googlePlanningReady={googlePlanningReady}
      schemaAvailable={schemaAvailable}
      initialDateKey={todayKey}
      initialDrivers={drivers}
      initialRuns={runs}
      initialSlots={slots.map((slot) => ({
        id: slot.id,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        periodKey: slot.periodKey,
        periodLabel: slot.periodLabel,
        capacity: slot.capacity,
        reservedCount: slot.reservedCount,
        remainingCapacity: slot.remainingCapacity,
        dateKey: slot.dateKey,
        note: slot.note,
        isOpen: slot.isOpen,
      }))}
    />
  );
}
