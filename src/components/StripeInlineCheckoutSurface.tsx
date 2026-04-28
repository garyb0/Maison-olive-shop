"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { StripeCheckoutContact, StripeCheckoutSession } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import { stripeClientReady, stripePromise } from "@/lib/stripe-client";

type AddressDefaults = {
  name?: string;
  line1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phoneNumber?: string;
};

type StripeInlineCheckoutProps = {
  clientSecret: string;
  returnUrl: string;
  submitLabel: string;
  loadingLabel: string;
  headline: string;
  description: string;
  errorMessage?: string;
  defaults?: AddressDefaults;
  language?: "fr" | "en";
  variant?: "default" | "summary";
  onSuccess: (session: StripeCheckoutSession) => void;
  onError: (message: string) => void;
};

function normalizeStripeMessage(message: string, language: "fr" | "en") {
  const normalized = message.toLowerCase();

  if (normalized.includes("customer_email") && normalized.includes("checkout session")) {
    return language === "fr"
      ? "Le courriel est déjà verrouillé pour cette tentative. Recharge la page et relance le paiement par carte."
      : "The email is already locked for this attempt. Refresh the page and start the card payment again.";
  }

  if (normalized.includes("phone_number_collection.enabled")) {
    return language === "fr"
      ? "Le téléphone est déjà géré par ton formulaire de livraison. Recharge la page et relance le paiement par carte."
      : "The phone number is already handled by your delivery form. Refresh the page and start the card payment again.";
  }

  return message;
}

function StripeInlineCheckoutForm({
  submitLabel,
  loadingLabel,
  returnUrl,
  language = "fr",
  variant = "default",
  onSuccess,
  onError,
}: Pick<
  StripeInlineCheckoutProps,
  "submitLabel" | "loadingLabel" | "returnUrl" | "language" | "variant" | "onSuccess" | "onError"
>) {
  const checkoutState = useCheckout();
  const [submitting, setSubmitting] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div className="small" style={{ color: "#6f624d" }}>
        {language === "fr" ? "Chargement du formulaire de paiement..." : "Loading the payment form..."}
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="auth-alert auth-alert--err">
        <span>⚠️</span> {normalizeStripeMessage(checkoutState.error.message, language)}
      </div>
    );
  }

  const { checkout } = checkoutState;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const result = await checkout.confirm({
        redirect: "if_required",
        returnUrl,
      });

      if (result.type === "error") {
        onError(normalizeStripeMessage(result.error.message, language));
        return;
      }

      onSuccess(result.session);
    } catch (error) {
      onError(
        error instanceof Error
          ? normalizeStripeMessage(error.message, language)
          : language === "fr"
            ? "La confirmation du paiement a échoué."
            : "Payment confirmation failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
      <PaymentElement
        options={{
          layout: variant === "summary" ? "accordion" : "tabs",
        }}
      />

      <button className="btn btn-full" disabled={submitting || !checkout.canConfirm} type="submit">
        {submitting ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}

export function StripeInlineCheckout({
  clientSecret,
  returnUrl,
  submitLabel,
  loadingLabel,
  headline,
  description,
  errorMessage,
  defaults,
  language = "fr",
  variant = "default",
  onSuccess,
  onError,
}: StripeInlineCheckoutProps) {
  const isSummaryVariant = variant === "summary";
  const defaultContact = useMemo<StripeCheckoutContact | undefined>(() => {
    if (!defaults?.line1 || !defaults.city || !defaults.country) {
      return undefined;
    }

    return {
      name: defaults.name,
      address: {
        line1: defaults.line1,
        city: defaults.city,
        postal_code: defaults.postalCode,
        state: defaults.region,
        country: defaults.country,
      },
    };
  }, [defaults]);

  if (!stripeClientReady) {
    return (
      <div className="auth-alert auth-alert--err">
        <span>⚠️</span>{" "}
        {errorMessage ??
          (language === "fr"
            ? "Stripe n'est pas prêt côté navigateur. Ajoute NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."
            : "Stripe is not ready in the browser. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.")}
      </div>
    );
  }

  return (
    <div
      className="support-lite-card"
      style={{
        marginTop: isSummaryVariant ? 0 : 16,
        padding: isSummaryVariant ? 18 : 24,
        gap: isSummaryVariant ? 12 : undefined,
        border: isSummaryVariant ? "1px solid rgba(92, 107, 64, 0.18)" : "1px solid rgba(197, 170, 109, 0.22)",
        background: isSummaryVariant
          ? "linear-gradient(180deg, rgba(248, 251, 242, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)"
          : undefined,
        boxShadow: isSummaryVariant ? "inset 0 1px 0 rgba(255, 255, 255, 0.85)" : undefined,
      }}
    >
      <div style={{ display: "grid", gap: 6, marginBottom: isSummaryVariant ? 10 : 18 }}>
        <p className="support-lite-card__eyebrow" style={{ margin: 0 }}>
          {language === "fr" ? "Paiement sécurisé par carte" : "Secure card payment"}
        </p>
        <h3 className="support-lite-card__title" style={{ margin: 0 }}>
          {headline}
        </h3>
        <p className="small support-lite-card__text" style={{ margin: 0 }}>
          {description}
        </p>
      </div>

      {errorMessage ? (
        <div className="auth-alert auth-alert--err" style={{ marginBottom: 16 }}>
          <span>⚠️</span> {normalizeStripeMessage(errorMessage, language)}
        </div>
      ) : null}

      <CheckoutElementsProvider
        key={clientSecret}
        stripe={stripePromise}
        options={{
          clientSecret,
          defaultValues: {
            billingAddress: defaultContact,
            shippingAddress: defaultContact,
          },
          elementsOptions: {
            loader: "auto",
            appearance: {
              variables: {
                colorPrimary: "#5c6b40",
                colorBackground: "#fffdf7",
                colorText: "#2c1e0f",
                colorDanger: "#b42318",
                borderRadius: "16px",
              },
            },
          },
        }}
      >
        <StripeInlineCheckoutForm
          submitLabel={submitLabel}
          loadingLabel={loadingLabel}
          returnUrl={returnUrl}
          language={language}
          variant={variant}
          onSuccess={onSuccess}
          onError={onError}
        />
      </CheckoutElementsProvider>
    </div>
  );
}
