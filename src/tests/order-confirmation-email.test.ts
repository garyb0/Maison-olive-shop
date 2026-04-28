import { buildOrderConfirmationEmail } from "@/lib/business";

describe("buildOrderConfirmationEmail", () => {
  it("genere un reçu facture detaille en francais", () => {
    const message = buildOrderConfirmationEmail({
      orderNumber: "MO-20260417-1234",
      customerName: "Jane Olive",
      customerEmail: "jane@example.com",
      orderCreatedAt: "2026-04-17T10:30:00.000Z",
      subtotalCents: 7000,
      discountCents: 500,
      shippingCents: 899,
      totalCents: 8507,
      currency: "CAD",
      language: "fr",
      paymentMethod: "STRIPE",
      deliveryStatus: "SCHEDULED",
      shippingLine1: "123 Rue Olive",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 1A1",
      shippingCountry: "CA",
      deliveryPhone: "418-555-1111",
      deliveryInstructions: "Laisser à la porte",
      deliveryWindowStartAt: "2026-04-18T14:00:00.000Z",
      deliveryWindowEndAt: "2026-04-18T16:00:00.000Z",
      items: [
        {
          name: "Croquettes Olive",
          quantity: 2,
          unitPriceCents: 2500,
          lineTotalCents: 5000,
        },
        {
          name: "Jouet Olive",
          quantity: 1,
          unitPriceCents: 2000,
          lineTotalCents: 2000,
        },
      ],
    });

    expect(message.subject).toContain("Facture et confirmation de commande");
    expect(message.text).toContain("Articles:");
    expect(message.text).toContain("Rabais promo");
    expect(message.text).toContain("Total avant taxes");
    expect(message.text).toContain("TPS (5%)");
    expect(message.text).toContain("TVQ (9,975%)");
    expect(message.text).toContain("Taxes totales");
    expect(message.text).toContain("Mode de paiement: Paiement en ligne (Stripe)");
    expect(message.text).toContain("Adresse de livraison: 123 Rue Olive, Rimouski, QC, G5L 1A1, CA");
    expect(message.html).toContain("Facture client");
    expect(message.html).toContain("Croquettes Olive");
    expect(message.html).toContain("Total avant taxes");
  });
});
