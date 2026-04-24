import { getCurrentLanguage } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDogProfilesForUser } from "@/lib/dogs";
import { DogsClient } from "./dogs-client";

export default async function AccountDogsPage() {
  const [user, language] = await Promise.all([getCurrentUser(), getCurrentLanguage()]);
  if (!user) {
    return null;
  }

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
        initialDogs={dogs.map((dog) => ({
          ...dog,
          claimedAt: dog.claimedAt?.toISOString() ?? null,
          createdAt: dog.createdAt.toISOString(),
          updatedAt: dog.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
