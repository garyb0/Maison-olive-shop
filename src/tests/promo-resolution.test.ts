export {};

const prismaMock = {
  promoCode: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("resolvePromoCodeDiscount", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prismaMock.promoCode.findFirst.mockResolvedValue(null);
  });

  it("utilise un code promo admin quand il existe", async () => {
    prismaMock.promoCode.findFirst.mockResolvedValue({
      code: "WELCOME15",
      description: "Rabais bienvenue",
      discountPercent: 15,
    });

    const { resolvePromoCodeDiscount } = await import("@/lib/promo");
    const promo = await resolvePromoCodeDiscount(10000, "welcome15");

    expect(promo.isValid).toBe(true);
    expect(promo.appliedCode).toBe("WELCOME15");
    expect(promo.discountPercent).toBe(15);
    expect(promo.discountCents).toBe(1500);
  });

  it("retombe sur le code legacy si aucun code admin n'existe", async () => {
    const { resolvePromoCodeDiscount } = await import("@/lib/promo");
    const promo = await resolvePromoCodeDiscount(10000, "OLIVE10");

    expect(promo.isValid).toBe(true);
    expect(promo.appliedCode).toBe("OLIVE10");
    expect(promo.discountPercent).toBe(10);
    expect(promo.discountCents).toBe(1000);
  });

  it("marque un code comme invalide si rien ne correspond", async () => {
    const { resolvePromoCodeDiscount } = await import("@/lib/promo");
    const promo = await resolvePromoCodeDiscount(10000, "INVALID");

    expect(promo.isValid).toBe(false);
    expect(promo.appliedCode).toBeNull();
    expect(promo.discountCents).toBe(0);
  });

  it("refuse explicitement le code promo de test meme s'il existe encore en base", async () => {
    prismaMock.promoCode.findFirst.mockResolvedValue({
      code: "TST90",
      description: "Test promo",
      discountPercent: 90,
    });

    const { resolvePromoCodeDiscount } = await import("@/lib/promo");
    const promo = await resolvePromoCodeDiscount(10000, "TST90");

    expect(promo.isValid).toBe(false);
    expect(promo.appliedCode).toBeNull();
    expect(promo.discountCents).toBe(0);
    expect(prismaMock.promoCode.findFirst).not.toHaveBeenCalled();
  });
});
