import { expect, test } from "@playwright/test";

type ProductPayload = {
  products?: Array<{
    id: string;
    isActive?: boolean;
    isSubscription?: boolean;
    stock?: number;
  }>;
};

type DeliverySlotsPayload = {
  slots?: Array<{
    periodKey?: "AM" | "PM";
    remainingCapacity?: number;
  }>;
};

test("le checkout affiche AM/PM avec une date de livraison claire", async ({ page, request }) => {
  const productsResponse = await request.get("/api/products");
  expect(productsResponse.ok()).toBe(true);

  const productsPayload = (await productsResponse.json()) as ProductPayload;
  const product = productsPayload.products?.find(
    (item) => item.isActive !== false && item.isSubscription !== true && (item.stock ?? 1) > 0,
  );
  expect(product?.id, "Un produit actif en stock est requis pour remplir le panier e2e.").toBeTruthy();

  const slotsResponse = await request.get("/api/delivery/slots?postalCode=G5L1A1&country=CA");
  expect(slotsResponse.ok()).toBe(true);

  const slotsPayload = (await slotsResponse.json()) as DeliverySlotsPayload;
  const availablePeriods = new Set(
    (slotsPayload.slots ?? [])
      .filter((slot) => (slot.remainingCapacity ?? 0) > 0)
      .map((slot) => slot.periodKey),
  );
  expect(availablePeriods.has("AM"), "La periode AM doit etre disponible pour ce smoke test.").toBe(true);
  expect(availablePeriods.has("PM"), "La periode PM doit etre disponible pour ce smoke test.").toBe(true);

  await page.addInitScript((productId) => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId, quantity: 1 }]));
  }, product?.id);

  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: /Finaliser ma commande/i })).toBeVisible();
  await expect(page.getByText(/Ton panier est vide/i)).toHaveCount(0);

  await page.getByPlaceholder(/G5L1A1/i).fill("G5L1A1");

  await expect(page.locator(".checkout-delivery-period-title", { hasText: /^AM$/ })).toBeVisible();
  await expect(page.locator(".checkout-delivery-period-title", { hasText: /^PM$/ })).toBeVisible();

  const selectedSummary = page
    .locator(".checkout-delivery-summary-card")
    .first()
    .locator("strong");

  await expect(selectedSummary).toHaveText(/^\p{L}+\s+\d{1,2}\s+\p{L}+\s+-\s+(AM|PM)$/u);
  await expect(selectedSummary).not.toContainText(/avr\.\s*(?:·|-)\s*AM/i);
});
