import { loadStripe } from "@stripe/stripe-js";

export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
export const stripeClientReady = Boolean(stripePublishableKey);
export const stripePromise = stripeClientReady
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null);
