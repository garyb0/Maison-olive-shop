import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDogProfileByPublicToken } from "@/lib/dogs";
import { DogClaimClient } from "./dog-claim-client";

type DogPageProps = {
  params: Promise<{ publicToken: string }>;
};

function phoneHref(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function renderDogVisual({
  photoUrl,
  name,
  showPhoto,
}: {
  photoUrl: string | null;
  name: string | null;
  showPhoto: boolean;
}) {
  if (showPhoto && photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name ?? "Dog"}
        className="mx-auto h-[280px] w-[280px] rounded-[34px] object-cover shadow-[0_28px_60px_rgba(80,67,36,0.18)]"
      />
    );
  }

  return (
    <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-[34px] bg-[linear-gradient(180deg,rgba(255,249,239,1),rgba(243,248,235,1))] text-center shadow-[0_24px_60px_rgba(80,67,36,0.12)]">
      <div>
        <div className="text-6xl font-semibold tracking-[0.18em] text-[#7a705b]">OLIVE</div>
        <p className="mt-4 text-sm font-medium uppercase tracking-[0.22em] text-[#7a705b]">
          {name ?? "Dog"}
        </p>
      </div>
    </div>
  );
}

export default async function DogPublicPage({ params }: DogPageProps) {
  const { publicToken } = await params;
  const [language, user, dog] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getDogProfileByPublicToken(publicToken),
  ]);

  if (!dog) {
    notFound();
  }

  const isClaimed = Boolean(dog.userId && dog.claimedAt);
  const isOwner = Boolean(user && dog.userId === user.id);

  if (!isClaimed) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffefb_0%,_#fbf2df_45%,_#edf3e3_100%)] px-4 py-10 text-stone-800">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
          <section className="grid w-full items-center gap-10 rounded-[36px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(80,67,36,0.12)] backdrop-blur md:grid-cols-[0.95fr_1.05fr] md:p-10">
            <div className="text-center">
              {renderDogVisual({ photoUrl: dog.photoUrl, name: dog.name, showPhoto: true })}
              <p className="mt-5 text-sm font-medium text-[#8c6841]">
                {language === "fr"
                  ? "Ce collier attend encore sa première activation."
                  : "This collar is still waiting for its first activation."}
              </p>
            </div>

            <div>
              <span className="inline-flex rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-semibold text-[#9a7042] ring-1 ring-[#f3dfba]">
                {language === "fr" ? "Activation du collier" : "Collar activation"}
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-stone-900 md:text-5xl">
                {language === "fr"
                  ? "Ce collier n'est pas encore activé."
                  : "This collar is not activated yet."}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
                {language === "fr"
                  ? "Le parent du chien doit se connecter ou créer son compte Chez Olive pour publier la fiche."
                  : "The dog's parent needs to sign in or create a Chez Olive account to publish the profile."}
              </p>

              <div className="mt-8">
                <DogClaimClient
                  language={language}
                  publicToken={dog.publicToken}
                  user={user}
                  initialName={dog.name}
                  initialPhotoUrl={dog.photoUrl}
                  initialAgeLabel={dog.ageLabel}
                  initialOwnerPhone={dog.ownerPhone}
                  initialImportantNotes={dog.importantNotes}
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!dog.isActive) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffefb_0%,_#f6f0e5_45%,_#edf3e3_100%)] px-4 py-10 text-stone-800">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
          <section className="w-full rounded-[32px] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(80,67,36,0.12)]">
            <div className="text-6xl font-semibold text-[#9a7042]">!</div>
            <h1 className="mt-4 text-4xl font-semibold text-stone-900">
              {language === "fr" ? "Ce médaillon est en pause" : "This tag is currently paused"}
            </h1>
            <p className="mt-4 text-lg leading-8 text-stone-600">
              {language === "fr"
                ? "Les informations publiques de ce chien ne sont pas disponibles pour le moment."
                : "This dog's public information is not available right now."}
            </p>
            {isOwner ? (
              <Link className="btn mt-6" href="/account/dogs">
                {language === "fr" ? "Gérer mes chiens" : "Manage my dogs"}
              </Link>
            ) : null}
          </section>
        </div>
        <Link
          className="fixed bottom-5 right-5 inline-flex items-center rounded-full bg-[#5e7745] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#51683d]"
          href="/"
        >
          {language === "fr" ? "Retour chez Olive" : "Back to Chez Olive"}
        </Link>
      </main>
    );
  }

  const showPhoto = dog.publicProfileEnabled && dog.showPhotoPublic;
  const showAge = dog.publicProfileEnabled && dog.showAgePublic && Boolean(dog.ageLabel);
  const showNotes = dog.publicProfileEnabled && dog.showNotesPublic && Boolean(dog.importantNotes);
  const canCall = dog.publicProfileEnabled && dog.showPhonePublic;
  const telHref = canCall ? phoneHref(dog.ownerPhone) : null;
  const hasAnyPublicDetails = Boolean(showAge || showNotes || telHref);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffefb_0%,_#fbf2df_40%,_#eef4e3_100%)] px-4 py-10 text-stone-800">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full items-center gap-10 rounded-[40px] border border-white/75 bg-[rgba(255,255,255,0.9)] p-6 shadow-[0_28px_90px_rgba(80,67,36,0.14)] backdrop-blur md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div className="text-center">
            {renderDogVisual({ photoUrl: dog.photoUrl, name: dog.name, showPhoto })}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {showAge ? (
                <span className="rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-medium text-[#9a7042] ring-1 ring-[#f3dfba]">
                  {dog.ageLabel}
                </span>
              ) : null}
              <span className="rounded-full bg-[#f8fbf2] px-4 py-2 text-sm font-medium text-[#5e7745] ring-1 ring-[#dfe8d0]">
                {dog.publicProfileEnabled
                  ? language === "fr"
                    ? "Profil protégé"
                    : "Protected profile"
                  : language === "fr"
                    ? "Mode privé"
                    : "Private mode"}
              </span>
            </div>
          </div>

          <div>
            <span className="inline-flex rounded-full bg-[#eef4e3] px-4 py-2 text-sm font-semibold text-[#4f6b36]">
              {language === "fr" ? "Si tu m'as trouvé..." : "If you found me..."}
            </span>
            <h1 className="mt-5 text-5xl font-semibold leading-tight text-stone-900">
              {dog.name ?? (language === "fr" ? "Un chien adorable" : "A lovely dog")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
              {language === "fr"
                ? "Merci de m'aider à retrouver ma famille. Les informations visibles ici sont limitées pour protéger notre vie privée."
                : "Thank you for helping me get back to my family. The information shown here is intentionally limited to protect our privacy."}
            </p>

            <div className="mt-8 grid gap-4">
              {telHref ? (
                <a
                  className="inline-flex items-center justify-center rounded-[22px] bg-[#5e7745] px-6 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(94,119,69,0.24)] transition hover:bg-[#51683d]"
                  href={telHref}
                >
                  {language === "fr" ? "Appeler mon parent" : "Call my human"}
                </a>
              ) : null}

              {showNotes ? (
                <article className="rounded-[24px] border border-[#dfe8d0] bg-[#f8fbf2] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e7745]">
                    {language === "fr" ? "Notes importantes" : "Important notes"}
                  </p>
                  <p className="mt-3 text-base leading-7 text-stone-700">{dog.importantNotes}</p>
                </article>
              ) : null}

              {!hasAnyPublicDetails ? (
                <article className="rounded-[24px] border border-[#efe3cb] bg-[#fff9ef] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7042]">
                    {language === "fr" ? "Confidentialité" : "Privacy"}
                  </p>
                  <p className="mt-3 text-base leading-7 text-stone-700">
                    {language === "fr"
                      ? "Les informations de contact sont privées pour le moment."
                      : "Contact details are private for now."}
                  </p>
                </article>
              ) : null}

              {isOwner ? (
                <Link className="btn btn-secondary" href="/account/dogs">
                  {language === "fr" ? "Gérer cette fiche dans mon compte" : "Manage this profile in my account"}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <Link
        className="fixed bottom-5 right-5 inline-flex items-center rounded-full bg-[#5e7745] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#51683d]"
        href="/"
      >
        {language === "fr" ? "Visiter Chez Olive" : "Visit Chez Olive"}
      </Link>
    </main>
  );
}
