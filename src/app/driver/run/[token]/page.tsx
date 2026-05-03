import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import {
  getDriverRunSnapshot,
  isDeliveryGpsTrackingEnabled,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";
import { getWebPushPublicKey } from "@/lib/app-notifications";
import { DriverRunClient } from "./run-client";

type Props = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

function getDriverRunErrorMessage(message: string, language: "fr" | "en") {
  if (language !== "fr") return message;

  switch (message) {
    case "Experimental delivery runs are disabled.":
      return "Les tournées chauffeur sont désactivées pour cet environnement.";
    case "Delivery runs schema is unavailable. Run Prisma migrations first.":
      return "Le schéma des tournées est indisponible. Les migrations Prisma doivent être appliquées.";
    case "Delivery run not found.":
      return "Tournée introuvable.";
    case "This driver link is no longer valid.":
      return "Ce lien chauffeur n'est plus valide.";
    case "Unable to process the delivery run request.":
      return "Impossible de traiter cette tournée chauffeur.";
    default:
      return message;
  }
}

export default async function DriverRunPage({ params }: Props) {
  const [{ token }, language] = await Promise.all([params, getCurrentLanguage()]);
  let run: Awaited<ReturnType<typeof getDriverRunSnapshot>>;

  try {
    run = await getDriverRunSnapshot(token);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return (
      <main className="section driver-run-shell">
        <div className="admin-card driver-run-invalid">
          <span className="admin-page-header__eyebrow">
            {language === "fr" ? "Accès chauffeur" : "Driver access"}
          </span>
          <h1>{language === "fr" ? "Lien chauffeur invalide" : "Invalid driver link"}</h1>
          <p className="small">{getDriverRunErrorMessage(mapped.message, language)}</p>
          <p className="small">
            {language === "fr"
              ? "Demande un nouveau lien à l’équipe Chez Olive si cette tournée est toujours active."
              : "Ask the Chez Olive team for a new link if this run is still active."}
          </p>
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
      pushPublicKey={getWebPushPublicKey()}
      initialRun={run}
    />
  );
}
