import { jsonError, jsonOk } from "@/lib/http";
import { getHiddenStorefrontProductSlugs } from "@/lib/launch-guards";
import { resolvePromoCodeDiscount } from "@/lib/promo";
import { prisma } from "@/lib/prisma";
import { computeOrderAmounts } from "@/lib/taxes";
import { checkoutSchema } from "@/lib/validators";
import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse({
      ...body,
      paymentMethod: body?.paymentMethod ?? "MANUAL",
    });

    if (!parsed.success) {
      return jsonError("Invalid checkout request", 400);
    }

    const input = parsed.data;

    if (
      input.shippingPostal &&
      !isRimouskiDeliveryAddress({
        postalCode: input.shippingPostal,
        country: input.shippingCountry,
      })
    ) {
      return jsonError("Delivery area not supported", 400);
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        isActive: true,
        slug: { notIn: getHiddenStorefrontProductSlugs() },
      },
      select: {
        id: true,
        priceCents: true,
        stock: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            stock: true,
            priceCents: true,
          },
        },
      },
    });

    const map = new Map(products.map((p) => [p.id, p] as const));

    const resolvedItems = input.items.map((item) => {
      const product = map.get(item.productId);
      if (!product) return jsonError("Product not found", 404);
      if (item.quantity <= 0) return jsonError("Invalid quantity", 400);

      if (product.variants.length > 0) {
        if (!item.variantId) return jsonError("Product variant required", 400);
        const variant = product.variants.find((candidate) => candidate.id === item.variantId);
        if (!variant) return jsonError("Product variant not found", 404);
        if (variant.stock < item.quantity) return jsonError("Insufficient stock", 409);
        return { quantity: item.quantity, unitPriceCents: variant.priceCents ?? product.priceCents };
      }

      if (product.stock < item.quantity) return jsonError("Insufficient stock", 409);
      return { quantity: item.quantity, unitPriceCents: product.priceCents };
    });

    const earlyResponse = resolvedItems.find((item): item is Response => item instanceof Response);
    if (earlyResponse) return earlyResponse;
    const pricedItems = resolvedItems.filter(
      (item): item is { quantity: number; unitPriceCents: number } => !(item instanceof Response),
    );

    const subtotalCents = pricedItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );

    const promo = await resolvePromoCodeDiscount(subtotalCents, input.promoCode);
    const quote = computeOrderAmounts(subtotalCents, promo.discountCents);
    return jsonOk({
      quote,
      appliedPromo: promo.isValid
        ? {
            code: promo.appliedCode,
            description: promo.description,
            discountPercent: promo.discountPercent,
          }
        : null,
      promoCodeStatus: promo.normalizedCode ? (promo.isValid ? "valid" : "invalid") : "empty",
    });
  } catch {
    return jsonError("Failed to compute checkout quote", 500);
  }
}
