import { jsonError, jsonOk } from "@/lib/http";
import { getPromoDiscountCents } from "@/lib/promo";
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
      },
      select: { id: true, priceCents: true },
    });

    const map = new Map(products.map((p) => [p.id, p] as const));

    for (const item of input.items) {
      const product = map.get(item.productId);
      if (!product) return jsonError("Product not found", 404);
      if (item.quantity <= 0) return jsonError("Invalid quantity", 400);
    }

    const subtotalCents = input.items.reduce((sum, item) => {
      const product = map.get(item.productId)!;
      return sum + product.priceCents * item.quantity;
    }, 0);

    const discountCents = getPromoDiscountCents(subtotalCents, input.promoCode);
    const quote = computeOrderAmounts(subtotalCents, discountCents);
    return jsonOk({ quote });
  } catch {
    return jsonError("Failed to compute checkout quote", 500);
  }
}
