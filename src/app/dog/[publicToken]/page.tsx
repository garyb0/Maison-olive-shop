import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getDogProfileByPublicToken } from "@/lib/dogs";
import { DogClaimClient } from "./dog-claim-client";
import { DogLocationShare } from "./dog-location-share";
import { DogQrViewTracker } from "./dog-qr-view-tracker";

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
  const dogName = dog.name ?? (language === "fr" ? "Un chien adorable" : "A lovely dog");
  const lostMode = dog.lostModeEnabled;
  const lostModeMessage = dog.lostModeMessage?.trim();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffefb_0%,_#fbf2df_38%,_#eef4e3_100%)] px-4 py-6 text-stone-800 sm:py-10">
      {!isOwner ? <DogQrViewTracker publicToken={dog.publicToken} /> : null}
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] border border-white/75 bg-white/90 shadow-[0_28px_90px_rgba(80,67,36,0.14)] backdrop-blur">
          <div className="grid md:grid-cols-[0.88fr_1.12fr]">
            <div className="bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(244,249,237,0.96))] p-5 text-center sm:p-8">
              {renderDogVisual({ photoUrl: dog.photoUrl, name: dog.name, showPhoto })}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {showAge ? (
                  <span className="rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-medium text-[#9a7042] ring-1 ring-[#f3dfba]">
                    {dog.ageLabel}
                  </span>
                ) : null}
                <span className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${lostMode ? "bg-[#fff1e8] text-[#9a4f27] ring-[#f0cfb7]" : "bg-[#f8fbf2] text-[#5e7745] ring-[#dfe8d0]"}`}>
                  {lostMode
                    ? language === "fr"
                      ? "Mode chien perdu"
                      : "Lost dog mode"
                    : dog.publicProfileEnabled
                    ? language === "fr"
                      ? "Profil protégé"
                      : "Protected profile"
                    : language === "fr"
                      ? "Mode privé"
                      : "Private mode"}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-9">
              <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${lostMode ? "bg-[#fff1e8] text-[#9a4f27]" : "bg-[#eef4e3] text-[#4f6b36]"}`}>
                {lostMode ? (language === "fr" ? "Chien perdu" : "Lost dog") : language === "fr" ? "Chien trouvé" : "Found dog"}
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-stone-900 sm:text-5xl">
                {lostMode
                  ? language === "fr"
                    ? `${dogName} est recherché`
                    : `${dogName} is missing`
                  : dogName}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
                {lostMode
                  ? language === "fr"
                    ? "Merci d'aider sa famille. Si tu peux rester près du chien en sécurité, utilise les actions ci-dessous."
                    : "Thank you for helping their family. If you can safely stay near the dog, use the actions below."
                  : language === "fr"
                  ? "Merci, tu es au bon endroit. Reste près du chien si c'est sécuritaire, puis utilise les informations autorisées par sa famille."
                  : "Thank you, you are in the right place. Stay near the dog if it is safe, then use the information their family chose to share."}
              </p>

              <div className="mt-7 grid gap-4">
                {lostMode ? (
                  <article className="rounded-[24px] border border-[#f0cfb7] bg-[#fff7ef] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a4f27]">
                      {language === "fr" ? "Alerte famille" : "Family alert"}
                    </p>
                    <p className="mt-3 text-base leading-7 text-stone-700">
                      {lostModeMessage ||
                        (language === "fr"
                          ? "Ce chien est déclaré perdu. Toute aide est précieuse."
                          : "This dog has been marked as missing. Any help matters.")}
                    </p>
                  </article>
                ) : null}

                {telHref ? (
                  <div className="rounded-[24px] border border-[#dfe8d0] bg-[#f8fbf2] p-4">
                    <p className="text-sm font-medium text-[#4f6b36]">
                      {language === "fr"
                        ? "La famille a autorisé l'appel direct."
                        : "The family allowed direct calling."}
                    </p>
                    <a
                      className="mt-3 inline-flex w-full items-center justify-center rounded-[20px] bg-[#4f6b36] px-6 py-5 text-lg font-semibold text-white shadow-[0_18px_34px_rgba(79,107,54,0.26)] transition hover:bg-[#455e30]"
                      href={telHref}
                    >
                      {language === "fr" ? "Appeler mon parent" : "Call my human"}
                    </a>
                  </div>
                ) : null}

                {lostMode && !isOwner ? <DogLocationShare language={language} publicToken={dog.publicToken} /> : null}

                {showNotes ? (
                  <article className="rounded-[24px] border border-[#efe3cb] bg-[#fff9ef] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7042]">
                      {language === "fr" ? "À savoir tout de suite" : "Know this first"}
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

                <p className="text-sm leading-6 text-stone-500">
                  {language === "fr"
                    ? "Les détails affichés ici sont volontairement limités pour protéger la vie privée du chien et de sa famille."
                    : "The details shown here are intentionally limited to protect the dog and their family's privacy."}
                </p>

              </div>
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
