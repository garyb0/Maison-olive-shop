import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    })
  : null;

export const stripeEnabled = Boolean(stripe);
