import { env } from "@/lib/env";
import {
  createStripeServerClient,
  STRIPE_API_VERSION,
} from "@/lib/stripe-server";

export { STRIPE_API_VERSION };

export const stripe = env.stripeSecretKey
  ? createStripeServerClient(env.stripeSecretKey)
  : null;

export const stripeEnabled = Boolean(stripe);

export async function getCheckoutSession(sessionId: string) {
  if (!stripe) {
    return null;
  }

  return stripe.checkout.sessions.retrieve(sessionId);
}
