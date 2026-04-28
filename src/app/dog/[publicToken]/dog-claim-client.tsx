"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentUser } from "@/lib/types";
import type { Language } from "@/lib/i18n";
import { DogPhotoUpload } from "@/components/DogPhotoUpload";

type Props = {
  language: Language;
  publicToken: string;
  user: CurrentUser | null;
  initialName?: string | null;
  initialPhotoUrl?: string | null;
  initialAgeLabel?: string | null;
  initialOwnerPhone?: string | null;
  initialImportantNotes?: string | null;
};

export function DogClaimClient({
  language,
  publicToken,
  user,
  initialName,
  initialPhotoUrl,
  initialAgeLabel,
  initialOwnerPhone,
  initialImportantNotes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [ageLabel, setAgeLabel] = useState(initialAgeLabel ?? "");
  const [ownerPhone, setOwnerPhone] = useState(initialOwnerPhone ?? "");
  const [importantNotes, setImportantNotes] = useState(initialImportantNotes ?? "");

  const authSuccessMessage =
    language === "fr"
      ? "Compte prêt. Tu peux maintenant activer ce collier."
      : "Your account is ready. You can now activate this collar.";

  const claimSuccessMessage =
    language === "fr"
      ? "Collier activé avec succès."
      : "Collar activated successfully.";

  const handleLogin = async (formData: FormData) => {
    setError("");
    setMessage("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        setError(language === "fr" ? "Connexion impossible." : "Unable to sign in.");
        return;
      }

      setMessage(authSuccessMessage);
      router.refresh();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (formData: FormData) => {
    setError("");
    setMessage("");
    setRegisterLoading(true);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          language,
        }),
      });

      if (!registerResponse.ok) {
        setError(language === "fr" ? "Inscription impossible." : "Unable to register.");
        return;
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        setMessage(
          language === "fr"
            ? "Compte créé. Connecte-toi pour activer le collier."
            : "Account created. Sign in to activate the collar.",
        );
        return;
      }

      setMessage(authSuccessMessage);
      router.refresh();
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleClaim = async () => {
    setError("");
    setMessage("");
    setClaimLoading(true);

    try {
      const response = await fetch("/api/account/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          name,
          photoUrl,
          ageLabel,
          ownerPhone,
          importantNotes,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(
          payload.error ??
            (language === "fr" ? "Activation du collier impossible." : "Unable to activate the collar."),
        );
        return;
      }

      setMessage(claimSuccessMessage);
      router.refresh();
    } finally {
      setClaimLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[28px] border border-[#efe3cb] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            {language === "fr" ? "J'ai déjà un compte" : "I already have an account"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {language === "fr"
              ? "Connecte-toi pour activer ce collier et créer la fiche de ton chien."
              : "Sign in to activate this collar and create your dog's profile."}
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin(new FormData(event.currentTarget));
            }}
          >
            <input className="input" name="email" type="email" placeholder="ton@email.com" required />
            <input className="input" name="password" type="password" placeholder="••••••••" required />
            <button className="btn" disabled={loginLoading} type="submit">
              {loginLoading
                ? language === "fr"
                  ? "Connexion..."
                  : "Signing in..."
                : language === "fr"
                  ? "Me connecter"
                  : "Sign in"}
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-[#dfe8d0] bg-[#f8fbf2] p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            {language === "fr" ? "Je crée mon compte" : "Create my account"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {language === "fr"
              ? "En quelques instants, tu pourras activer le collier et remplir la fiche."
              : "In just a moment, you'll be able to activate the collar and fill in the profile."}
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRegister(new FormData(event.currentTarget));
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" name="firstName" placeholder={language === "fr" ? "Prénom" : "First name"} required />
              <input className="input" name="lastName" placeholder={language === "fr" ? "Nom" : "Last name"} required />
            </div>
            <input className="input" name="email" type="email" placeholder="ton@email.com" required />
            <input className="input" name="password" type="password" placeholder="••••••••" required />
            <button className="btn" disabled={registerLoading} type="submit">
              {registerLoading
                ? language === "fr"
                  ? "Création..."
                  : "Creating..."
                : language === "fr"
                  ? "Créer mon compte"
                  : "Create my account"}
            </button>
          </form>
        </section>

        {message ? (
          <p className="small ok md:col-span-2" style={{ marginTop: 8 }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="small md:col-span-2" style={{ marginTop: 8, color: "#8f3b2e" }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-[28px] border border-[#dfe8d0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">
            {language === "fr" ? "Active le collier" : "Activate the collar"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {language === "fr"
              ? "Entre les informations essentielles. La fiche démarre en mode privé, puis tu pourras choisir ce qui est visible dans ton compte."
              : "Enter the essential details. The profile starts in private mode, then you can choose what becomes visible from your account."}
          </p>
        </div>
        <span className="rounded-full bg-[#f8fbf2] px-4 py-2 text-sm font-medium text-[#5e7745] ring-1 ring-[#dfe8d0]">
          QR: {publicToken}
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        <input
          className="input"
          placeholder={language === "fr" ? "Nom du chien" : "Dog name"}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="input"
          placeholder={language === "fr" ? "\u00c2ge ou petit descriptif" : "Age or short label"}
          value={ageLabel}
          onChange={(event) => setAgeLabel(event.target.value)}
        />
        <input
          className="input"
          placeholder={language === "fr" ? "Numéro pour joindre le parent" : "Owner phone number"}
          value={ownerPhone}
          onChange={(event) => setOwnerPhone(event.target.value)}
        />
        <DogPhotoUpload language={language} value={photoUrl} onChange={setPhotoUrl} />
        <textarea
          className="textarea"
          rows={4}
          placeholder={
            language === "fr"
              ? "Notes importantes: timide, allergies, aime les friandises..."
              : "Important notes: shy, allergies, loves treats..."
          }
          value={importantNotes}
          onChange={(event) => setImportantNotes(event.target.value)}
        />
      </div>

      {message ? (
        <p className="small ok" style={{ marginTop: 16 }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="small" style={{ marginTop: 16, color: "#8f3b2e" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn" disabled={claimLoading} onClick={() => void handleClaim()} type="button">
          {claimLoading
            ? language === "fr"
              ? "Activation..."
              : "Activating..."
            : language === "fr"
              ? "Activer et publier"
              : "Activate and publish"}
        </button>
      </div>
    </section>
  );
}
