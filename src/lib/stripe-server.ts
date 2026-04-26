import Stripe from "stripe";

export const STRIPE_API_VERSION = Stripe.API_VERSION as Stripe.LatestApiVersion;

export function createStripeServerClient(secretKey: string) {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}
