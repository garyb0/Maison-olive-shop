import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getAdminDogProfiles } from "@/lib/dogs";
import { env } from "@/lib/env";
import { AdminDogsClient } from "./admin-dogs-client";

type AdminDogs = Awaited<ReturnType<typeof getAdminDogProfiles>>;
type AdminDog = AdminDogs[number];

export default async function AdminDogsPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  const dogs = await getAdminDogProfiles();

  return (
    <AdminDogsClient
      language={language}
      siteUrl={env.siteUrl}
      dogs={dogs.map((dog: AdminDog) => ({
        id: dog.id,
        publicToken: dog.publicToken,
        name: dog.name,
        isActive: dog.isActive,
        claimedAtLabel: dog.claimedAt
          ? formatDate(dog.claimedAt, language === "fr" ? "fr-CA" : "en-CA")
          : null,
        createdAtLabel: formatDate(dog.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
        ownerPhone: dog.ownerPhone,
        userId: dog.userId,
        ownerName:
          dog.user?.firstName || dog.user?.lastName
            ? [dog.user?.firstName, dog.user?.lastName].filter(Boolean).join(" ")
            : null,
        ownerEmail: dog.user?.email ?? null,
      }))}
    />
  );
}
