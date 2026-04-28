import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import {
  getDriverRunSnapshot,
  isDeliveryGpsTrackingEnabled,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";
import { DriverRunClient } from "./run-client";

type Props = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export default async function DriverRunPage({ params }: Props) {
  const [{ token }, language] = await Promise.all([params, getCurrentLanguage()]);
  let run: Awaited<ReturnType<typeof getDriverRunSnapshot>>;

  try {
    run = await getDriverRunSnapshot(token);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return (
      <main className="section driver-run-shell">
        <div className="admin-card">
          <h1>{language === "fr" ? "Lien chauffeur invalide" : "Invalid driver link"}</h1>
          <p className="small">{mapped.message}</p>
          <Link className="btn btn-secondary" href="/">
            {language === "fr" ? "Retour au site" : "Back to site"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <DriverRunClient
      language={language}
      token={token}
      gpsTrackingEnabled={isDeliveryGpsTrackingEnabled()}
      initialRun={run}
    />
  );
}
