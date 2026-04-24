import Stripe from "stripe";
import { env } from "@/lib/env";

export const STRIPE_API_VERSION = "2025-08-27.basil";

export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
  : null;

export const stripeEnabled = Boolean(stripe);

export async function getCheckoutSession(sessionId: string) {
  if (!stripe) {
    return null;
  }

  return stripe.checkout.sessions.retrieve(sessionId);
}
