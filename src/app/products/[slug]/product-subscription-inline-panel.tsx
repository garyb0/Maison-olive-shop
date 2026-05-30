"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StripeCheckoutSession } from "@stripe/stripe-js";
import { StripeInlineCheckout } from "@/components/StripeInlineCheckoutSurface";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { formatCurrency } from "@/lib/format";
import type { SubscriptionCheckoutResponse } from "@/lib/types";

type Product = {
  id: string;
  slug: string;
  isSubscription: boolean;
  priceWeekly: number | null;
  priceBiweekly: number | null;
  priceMonthly: number | null;
  priceQuarterly: number | null;
  currency: string;
  nameFr: string;
  nameEn: string;
};

type Props = {
  product: Product;
  language: "fr" | "en";
  isAuthenticated: boolean;
  initialStatus?: "idle" | "success" | "pending" | "cancelled";
  googleOAuthEnabled?: boolean;
};

const intervalLabels: Record<string, { fr: string; en: string }> = {
  WEEKLY: { fr: "Chaque semaine", en: "Every week" },
  BIWEEKLY: { fr: "Toutes les 2 semaines", en: "Every 2 weeks" },
  MONTHLY: { fr: "Chaque mois", en: "Every month" },
  QUARTERLY: { fr: "Chaque trimestre", en: "Every 3 months" },
};

const SUBSCRIPTION_GUIDE_STORAGE_KEY = "chezolive_subscription_guide_v1";

type SubscriptionGuideStep = "loading" | "prompt" | "frequency" | "payment" | "control" | "hidden";

const guideOrder: SubscriptionGuideStep[] = ["prompt", "frequency", "payment", "control"];

const guideCopy: Record<
  Exclude<SubscriptionGuideStep, "loading" | "hidden">,
  {
    eyebrow: { fr: string; en: string };
    title: { fr: string; en: string };
    body: { fr: string; en: string };
    primary: { fr: string; en: string };
  }
> = {
  prompt: {
    eyebrow: { fr: "Guide abonnement", en: "Subscription guide" },
    title: {
      fr: "Voulez-vous savoir comment nos abonnements fonctionnent?",
      en: "Want to see how subscriptions work?",
    },
    body: {
      fr: "C'est rapide: on vous montre la fréquence, le paiement et la gestion du compte.",
      en: "It is quick: we show frequency, payment, and account management.",
    },
    primary: { fr: "Suivant", en: "Next" },
  },
  frequency: {
    eyebrow: { fr: "Étape 1 de 3", en: "Step 1 of 3" },
    title: { fr: "Choisissez votre fréquence", en: "Choose your frequency" },
    body: {
      fr: "Sélectionnez le rythme qui convient à votre animal. Vous pouvez commencer par une seule fréquence.",
      en: "Pick the rhythm that fits your pet. You can start with one frequency.",
    },
    primary: { fr: "Suivant", en: "Next" },
  },
  payment: {
    eyebrow: { fr: "Étape 2 de 3", en: "Step 2 of 3" },
    title: { fr: "Connectez-vous pour confirmer", en: "Sign in to confirm" },
    body: {
      fr: "Un compte est requis pour sécuriser l'abonnement et éviter les commandes répétées anonymes.",
      en: "An account is required to secure the subscription and avoid anonymous recurring orders.",
    },
    primary: { fr: "Suivant", en: "Next" },
  },
  control: {
    eyebrow: { fr: "Étape 3 de 3", en: "Step 3 of 3" },
    title: { fr: "Vous gardez le contrôle", en: "You stay in control" },
    body: {
      fr: "Après l'inscription, vous pouvez suivre, modifier ou annuler l'abonnement depuis votre compte.",
      en: "After signing up, you can track, edit, or cancel the subscription from your account.",
    },
    primary: { fr: "J'ai compris", en: "Got it" },
  },
};

export function ProductSubscriptionInlineClient({
  product,
  language,
  isAuthenticated,
  initialStatus = "idle",
  googleOAuthEnabled = false,
}: Props) {
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const productName = language === "fr" ? product.nameFr : product.nameEn;
  const [loading, setLoading] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<string>("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "pending" | "cancelled">(initialStatus);
  const [embeddedCheckout, setEmbeddedCheckout] = useState<SubscriptionCheckoutResponse | null>(null);
  const [guideStep, setGuideStep] = useState<SubscriptionGuideStep>(isAuthenticated ? "hidden" : "loading");

  const availableIntervals = useMemo(
    () =>
      [
        { id: "WEEKLY", price: product.priceWeekly },
        { id: "BIWEEKLY", price: product.priceBiweekly },
        { id: "MONTHLY", price: product.priceMonthly },
        { id: "QUARTERLY", price: product.priceQuarterly },
      ].filter((interval) => interval.price != null && interval.price > 0),
    [product.priceBiweekly, product.priceMonthly, product.priceQuarterly, product.priceWeekly],
  );

  const selectedIntervalLabel = selectedInterval ? intervalLabels[selectedInterval][language] : "";
  const currentGuideCopy = guideStep !== "loading" && guideStep !== "hidden" ? guideCopy[guideStep] : null;
  const currentGuideIndex = guideOrder.indexOf(guideStep);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (isAuthenticated) {
        setGuideStep("hidden");
        return;
      }

      try {
        if (window.localStorage.getItem(SUBSCRIPTION_GUIDE_STORAGE_KEY) === "dismissed") {
          setGuideStep("hidden");
          return;
        }
      } catch {
        // localStorage can be unavailable in strict browser privacy modes.
      }

      setGuideStep("prompt");
    }, 250);

    return () => window.clearTimeout(id);
  }, [isAuthenticated]);

  if (!product.isSubscription || availableIntervals.length === 0) {
    return null;
  }

  const dismissGuide = () => {
    try {
      window.localStorage.setItem(SUBSCRIPTION_GUIDE_STORAGE_KEY, "dismissed");
    } catch {
      // Keep the dismissal local to this render if storage is unavailable.
    }

    setGuideStep("hidden");
  };

  const advanceGuide = () => {
    if (guideStep === "control") {
      dismissGuide();
      return;
    }

    const nextStep = guideOrder[currentGuideIndex + 1] ?? "control";
    setGuideStep(nextStep);
  };

  const subscribe = async () => {
    if (!selectedInterval) {
      return;
    }

    setLoading(true);
    setError("");
    setStatus("idle");

    try {
      const response = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          interval: selectedInterval,
          quantity: 1,
        }),
      });

      const data = (await response.json()) as SubscriptionCheckoutResponse & { error?: string };
      if (!response.ok) {
        setError(
          data.error ??
            (language === "fr"
              ? "Impossible de préparer l'abonnement pour le moment."
              : "Unable to prepare the subscription right now."),
        );
        return;
      }

      setEmbeddedCheckout(data);
    } catch {
      setError(
        language === "fr"
          ? "Une erreur est survenue pendant la préparation de l'abonnement."
          : "An error occurred while preparing the subscription.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSuccess = (session: StripeCheckoutSession) => {
    if (session.status.type === "complete") {
      setStatus("success");
      setEmbeddedCheckout(null);
      return;
    }

    setStatus("pending");
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: "1.2rem" }}>{"\u{1F501}"}</span>
        <strong>{language === "fr" ? "Abonnement récurrent" : "Recurring subscription"}</strong>
      </div>

      <p className="small" style={{ marginBottom: 16 }}>
        {language === "fr"
          ? "Choisis la fréquence qui te convient. Tu pourras gérer l'abonnement depuis ton compte."
          : "Choose the delivery frequency that works for you. You can manage the subscription from your account."}
      </p>

      {!isAuthenticated && currentGuideCopy ? (
        <div
          className="subscription-guide-popover"
          role="dialog"
          aria-live="polite"
          aria-labelledby="subscription-guide-title"
        >
          <button
            className="subscription-guide-popover__close"
            type="button"
            aria-label={language === "fr" ? "Fermer le guide" : "Close guide"}
            onClick={dismissGuide}
          >
            ×
          </button>
          <p className="subscription-guide-popover__eyebrow">{currentGuideCopy.eyebrow[language]}</p>
          <h3 id="subscription-guide-title">{currentGuideCopy.title[language]}</h3>
          <p>{currentGuideCopy.body[language]}</p>
          <div className="subscription-guide-popover__dots" aria-hidden="true">
            {guideOrder.map((step) => (
              <span
                key={step}
                className={guideOrder.indexOf(step) <= currentGuideIndex ? "is-active" : ""}
              />
            ))}
          </div>
          <div className="subscription-guide-popover__actions">
            <button className="btn btn-secondary" type="button" onClick={dismissGuide}>
              {language === "fr" ? "Plus tard" : "Maybe later"}
            </button>
            <button className="btn" type="button" onClick={advanceGuide}>
              {currentGuideCopy.primary[language]}
            </button>
          </div>
        </div>
      ) : null}

      {status === "success" ? (
        <div className="support-lite-card" style={{ padding: 20, marginBottom: 16 }}>
          <p className="support-lite-card__eyebrow" style={{ margin: 0 }}>
            {language === "fr" ? "Abonnement confirmé" : "Subscription confirmed"}
          </p>
          <h3 className="support-lite-card__title" style={{ margin: "0.25rem 0 0.5rem" }}>
            {language === "fr"
              ? `Merci, l'abonnement à ${productName} est prêt.`
              : `Thank you, your ${productName} subscription is ready.`}
          </h3>
          <p className="small support-lite-card__text" style={{ margin: 0 }}>
            {language === "fr"
              ? "Le paiement par carte est accepté. La synchronisation finale peut prendre quelques secondes."
              : "Card payment accepted. Final syncing can take a few seconds."}
          </p>
          <div className="support-lite-card__actions" style={{ marginTop: 16 }}>
            <Link className="btn" href="/account/subscriptions">
              {language === "fr" ? "Voir mes abonnements" : "View my subscriptions"}
            </Link>
            <Link className="btn btn-secondary" href={`/products/${product.slug}`}>
              {language === "fr" ? "Rester sur ce produit" : "Stay on this product"}
            </Link>
          </div>
        </div>
      ) : null}

      {status === "pending" ? (
        <div className="auth-alert auth-alert--ok" style={{ marginBottom: 16 }}>
          <span>OK</span>{" "}
          {language === "fr"
            ? "Le processeur de paiement a bien reçu la demande. La confirmation finale peut prendre quelques secondes."
            : "The payment processor received your request. Final confirmation can take a few seconds."}
        </div>
      ) : null}

      {status === "cancelled" ? (
        <div className="auth-alert auth-alert--err" style={{ marginBottom: 16 }}>
          <span>!</span>{" "}
          {language === "fr"
            ? "Le paiement d'abonnement a été interrompu. Tu peux reprendre quand tu veux."
            : "The subscription payment was interrupted. You can resume whenever you want."}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {availableIntervals.map((interval) => (
          <label
            key={interval.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 10,
              background: selectedInterval === interval.id ? "var(--accent-light)" : "var(--background)",
              cursor: "pointer",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name="subscription-interval"
                checked={selectedInterval === interval.id}
                onChange={() => {
                  setSelectedInterval(interval.id);
                  setEmbeddedCheckout(null);
                  setStatus("idle");
                  setError("");
                }}
              />
              <span>{intervalLabels[interval.id][language]}</span>
            </div>
            <strong>{formatCurrency(interval.price!, product.currency, locale)}</strong>
          </label>
        ))}
      </div>

      {!isAuthenticated ? (
        <div className="subscription-auth-actions">
          {googleOAuthEnabled ? (
            <GoogleAuthButton
              language={language}
              returnTo={`/products/${product.slug}`}
              className="btn-full"
              label={language === "fr" ? "Continuer avec Google" : "Continue with Google"}
            />
          ) : null}
          <Link className="btn btn-full" href={`/login?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`}>
            {language === "fr" ? "Se connecter pour s'abonner" : "Sign in to subscribe"}
          </Link>
        </div>
      ) : !embeddedCheckout ? (
        <button className="btn btn-full" disabled={!selectedInterval || loading} onClick={() => void subscribe()}>
          {loading
            ? "..."
            : language === "fr"
              ? "Préparer le paiement par carte"
              : "Prepare card payment"}
        </button>
      ) : (
        <StripeInlineCheckout
          clientSecret={embeddedCheckout.clientSecret}
          returnUrl={embeddedCheckout.returnUrl}
          submitLabel={
            language === "fr"
              ? `Confirmer ${selectedIntervalLabel || "l'abonnement"}`
              : `Confirm ${selectedIntervalLabel || "subscription"}`
          }
          loadingLabel={language === "fr" ? "Confirmation..." : "Confirming..."}
          headline={language === "fr" ? "Finaliser dans Chez Olive" : "Finish inside Chez Olive"}
          description={
            language === "fr"
              ? `Ton abonnement ${selectedIntervalLabel.toLowerCase()} à ${productName} se confirme ici, sans quitter la page sauf si la banque l'exige.`
              : `Your ${selectedIntervalLabel.toLowerCase()} ${productName} subscription is confirmed here, without leaving the page unless the bank requires it.`
          }
          errorMessage={error || undefined}
          language={language}
          onSuccess={handleStripeSuccess}
          onError={(message) => setError(message)}
        />
      )}

      {error ? (
        <div className="auth-alert auth-alert--err" style={{ marginTop: 16 }}>
          <span>!</span> {error}
        </div>
      ) : null}
    </div>
  );
}
