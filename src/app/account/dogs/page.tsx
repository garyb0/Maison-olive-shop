import { getCurrentLanguage } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDogProfilesForUser } from "@/lib/dogs";
import { normalizeDogPublicTokenInput } from "@/lib/dog-token";
import { DogsClient } from "./dogs-client";

type AccountDogsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountDogsPage({ searchParams }: AccountDogsPageProps) {
  const [user, language] = await Promise.all([getCurrentUser(), getCurrentLanguage()]);
  if (!user) {
    return null;
  }

  const query = searchParams ? await searchParams : {};
  const activationToken = normalizeDogPublicTokenInput(
    firstQueryValue(query.activate) ?? firstQueryValue(query.token) ?? "",
  );
  const dogs = await getDogProfilesForUser(user.id);

  return (
    <>
      <section className="section account-home-hero">
        <p className="account-home-hero__eyebrow">
          {language === "fr" ? "Compagnons" : "Companions"}
        </p>
        <h1>{language === "fr" ? "Mes chiens" : "My dogs"}</h1>
        <p className="small" style={{ marginBottom: 0, maxWidth: 620 }}>
          {language === "fr"
            ? "Active tes colliers QR, choisis ce qui reste privé et garde les informations utiles à jour."
            : "Activate your QR collars, choose what stays private, and keep the useful details up to date."}
        </p>
      </section>

      <DogsClient
        language={language}
        initialActivationToken={activationToken || null}
        initialDogs={dogs.map((dog) => {
          const { dogQrScans, _count, ...profile } = dog;
          const scanHistory = dogQrScans.map((scan) => ({
            ...scan,
            locationSharedAt: scan.locationSharedAt?.toISOString() ?? null,
            createdAt: scan.createdAt.toISOString(),
          }));

          return {
            ...profile,
            claimedAt: dog.claimedAt?.toISOString() ?? null,
            lostModeActivatedAt: dog.lostModeActivatedAt?.toISOString() ?? null,
            createdAt: dog.createdAt.toISOString(),
            updatedAt: dog.updatedAt.toISOString(),
            scanHistory,
            scanCount: _count.dogQrScans,
            lastScanAt: scanHistory[0]?.createdAt ?? null,
          };
        })}
      />
    </>
  );
}
