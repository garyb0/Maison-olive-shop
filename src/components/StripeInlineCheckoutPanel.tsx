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
  email?: string;
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
  onSuccess: (session: StripeCheckoutSession) => void;
  onError: (message: string) => void;
};

function StripeInlineCheckoutForm({
  submitLabel,
  loadingLabel,
  returnUrl,
  onSuccess,
  onError,
}: Pick<StripeInlineCheckoutProps, "submitLabel" | "loadingLabel" | "returnUrl" | "onSuccess" | "onError">) {
  const checkoutState = useCheckout();
  const [submitting, setSubmitting] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div className="small" style={{ color: "#6f624d" }}>
        Chargement du formulaire Stripe...
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="auth-alert auth-alert--err">
        <span>⚠️</span> {checkoutState.error.message}
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
        onError(result.error.message);
        return;
      }

      onSuccess(result.session);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Stripe confirmation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
      <PaymentElement
        options={{
          layout: "tabs",
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
  onSuccess,
  onError,
}: StripeInlineCheckoutProps) {
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
        {errorMessage ?? "Stripe n'est pas prêt côté navigateur. Ajoute NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."}
      </div>
    );
  }

  return (
    <div
      className="support-lite-card"
      style={{
        marginTop: 16,
        padding: 24,
        border: "1px solid rgba(197, 170, 109, 0.22)",
      }}
    >
      <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        <p className="support-lite-card__eyebrow" style={{ margin: 0 }}>
          Stripe intégré
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
          <span>⚠️</span> {errorMessage}
        </div>
      ) : null}

      <CheckoutElementsProvider
        key={clientSecret}
        stripe={stripePromise}
        options={{
          clientSecret,
          defaultValues: {
            email: defaults?.email,
            phoneNumber: defaults?.phoneNumber,
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
          onSuccess={onSuccess}
          onError={onError}
        />
      </CheckoutElementsProvider>
    </div>
  );
}
