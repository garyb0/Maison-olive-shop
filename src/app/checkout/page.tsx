import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { CheckoutClient } from "@/app/checkout/checkout-client";
import { getDeliveryAddressesForUser } from "@/lib/delivery-addresses";
import { env } from "@/lib/env";
import { getCheckoutConfirmation } from "@/lib/checkout-confirmation";
import { syncOrderPaymentFromStripeSession } from "@/lib/orders";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { getVariantDisplayName, sumActiveVariantStock } from "@/lib/product-variants";

type CatalogProduct = Awaited<ReturnType<typeof getActiveProducts>>[number];

type CheckoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const query = searchParams ? await searchParams : {};
  const [language, user] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
  ]);
  const orderNumber = getSearchParam(query.order)?.trim() ?? "";
  const registerEmail = getSearchParam(query.email)?.trim() ?? "";
  const stripeSessionId = getSearchParam(query.session_id)?.trim() ?? "";
  const initialMode = getSearchParam(query.mode)?.trim() === "manual" ? "manual" : "stripe";
  let initialStripeNotice: "paid" | "pending" | "cancelled" | null =
    getSearchParam(query.cancelled) === "1" ? "cancelled" : null;

  if (stripeSessionId) {
    try {
      const syncResult = await syncOrderPaymentFromStripeSession(stripeSessionId, user?.id);
      initialStripeNotice =
        syncResult?.transitionedToPaid || syncResult?.reason === "ALREADY_FINALIZED"
          ? "paid"
          : "pending";
    } catch {
      initialStripeNotice = "pending";
    }
  }

  const initialConfirmation =
    orderNumber && registerEmail
      ? await getCheckoutConfirmation(orderNumber, registerEmail)
      : null;

  const products = await getActiveProducts();
  const deliveryAddresses = user ? await getDeliveryAddressesForUser(user.id) : [];
  const t = getDictionary(language);

  const productIndex = Object.fromEntries(
    products.flatMap((product: CatalogProduct) => {
      const productName = language === "fr" ? product.nameFr : product.nameEn;
      const baseEntry = [
        product.id,
        {
          id: product.id,
          productId: product.id,
          name: productName,
          priceCents: product.priceCents,
          currency: product.currency,
          priceLabel: formatCurrency(product.priceCents, product.currency, language === "fr" ? "fr-CA" : "en-CA"),
          stock: product.variants.length > 0 ? sumActiveVariantStock(product.variants) : product.stock,
          requiresVariantSelection: product.variants.length > 0,
        },
      ] as const;
      const variantEntries = product.variants.map((variant) => {
        const priceCents = variant.priceCents ?? product.priceCents;
        return [
          `${product.id}:${variant.id}`,
          {
            id: `${product.id}:${variant.id}`,
            productId: product.id,
            variantId: variant.id,
            name: getVariantDisplayName(productName, variant, language),
            priceCents,
            currency: product.currency,
            priceLabel: formatCurrency(priceCents, product.currency, language === "fr" ? "fr-CA" : "en-CA"),
            stock: variant.stock,
          },
        ] as const;
      });

      return [baseEntry, ...variantEntries];
    }),
  );

  return (
    <CheckoutClient
      language={language}
      t={t}
      user={user}
      productIndex={productIndex}
      initialDeliveryAddresses={deliveryAddresses}
      shippingFlatCents={env.shippingFlatCents}
      shippingFreeThresholdCents={env.shippingFreeThresholdCents}
      initialConfirmation={initialConfirmation}
      initialPaymentMode={initialMode}
      initialStripeNotice={initialStripeNotice}
      googleOAuthEnabled={isGoogleOAuthConfigured()}
    />
  );
}
