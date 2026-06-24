import { expect, test } from "@playwright/test";

type ProductPayload = {
  products?: Array<{
    id: string;
    isActive?: boolean;
    isSubscription?: boolean;
    stock?: number;
    variants?: Array<{
      id: string;
      isActive?: boolean;
      stock?: number;
    }>;
  }>;
};

type DeliverySlotsPayload = {
  activeDriverCount?: number;
  slots?: Array<{
    periodKey?: "AM" | "PM";
    remainingCapacity?: number;
  }>;
};

function isSellableProduct(product: NonNullable<ProductPayload["products"]>[number]) {
  const variantInStock = product.variants?.some((variant) => variant.isActive !== false && (variant.stock ?? 0) > 0);
  return product.isActive !== false && product.isSubscription !== true && (variantInStock || (product.stock ?? 0) > 0);
}

function getCartLine(product: NonNullable<ProductPayload["products"]>[number]) {
  const variant = product.variants?.find((item) => item.isActive !== false && (item.stock ?? 0) > 0);
  return variant ? { productId: product.id, variantId: variant.id, quantity: 1 } : { productId: product.id, quantity: 1 };
}

test("le checkout affiche AM/PM avec une date de livraison claire", async ({ page, request }) => {
  const productsResponse = await request.get("/api/products");
  expect(productsResponse.ok()).toBe(true);

  const productsPayload = (await productsResponse.json()) as ProductPayload;
  const product = productsPayload.products?.find(isSellableProduct);
  expect(product?.id, "Un produit actif en stock est requis pour remplir le panier e2e.").toBeTruthy();

  const slotsResponse = await request.get("/api/delivery/slots?postalCode=G5L1A1&country=CA");
  expect(slotsResponse.ok()).toBe(true);

  const slotsPayload = (await slotsResponse.json()) as DeliverySlotsPayload;
  const availablePeriods = new Set(
    (slotsPayload.slots ?? [])
      .filter((slot) => (slot.remainingCapacity ?? 0) > 0)
      .map((slot) => slot.periodKey),
  );
  await page.addInitScript((line) => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([line]));
  }, getCartLine(product!));

  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: /Finaliser ma commande/i })).toBeVisible();
  await expect(page.getByText(/Ton panier est vide/i)).toHaveCount(0);

  await page.getByPlaceholder(/G5L1A1/i).fill("G5L1A1");

  if (!availablePeriods.has("AM") || !availablePeriods.has("PM")) {
    expect(slotsPayload.activeDriverCount ?? 0, "zero active drivers should explain missing checkout windows").toBe(0);
    await expect(page.locator(".checkout-delivery-empty")).toBeVisible();
    await expect(page.locator(".checkout-delivery-empty")).toContainText(/Planification|Manual|Aucune|No delivery/i);
    return;
  }

  await expect(page.locator(".checkout-delivery-period-title", { hasText: /^AM$/ })).toBeVisible();
  await expect(page.locator(".checkout-delivery-period-title", { hasText: /^PM$/ })).toBeVisible();

  const selectedSummary = page
    .locator(".checkout-delivery-summary-card")
    .first()
    .locator("strong");

  await expect(selectedSummary).toHaveText(/^\p{L}+\s+\d{1,2}\s+\p{L}+\s+-\s+(AM|PM)$/u);
  await expect(selectedSummary).not.toContainText(/avr\.\s*(?:·|-)\s*AM/i);
});
