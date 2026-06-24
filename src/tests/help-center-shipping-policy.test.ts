export {};

describe("help center shipping policy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SHIPPING_FLAT_CENTS", "899");
    vi.stubEnv("SHIPPING_FREE_THRESHOLD_CENTS", "7500");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("utilise les frais et le seuil de livraison de l'environnement", async () => {
    const { getBusinessInfo } = await import("@/lib/business");
    const { getShippingSections } = await import("@/lib/help-center");

    const business = getBusinessInfo("fr");
    expect(business.shippingPolicy).toMatch(/Livraison à domicile forfaitaire de 8,99/);
    expect(business.shippingPolicy).toMatch(/Gratuite dès 75,00/);
    expect(business.shippingPolicy).toContain("après rabais, avant taxes");

    const sections = getShippingSections("fr", business);
    const shippingFees = sections.find((section) => section.title === "Frais de livraison");

    expect(shippingFees?.body).toBe(business.shippingPolicy);
  });
});
