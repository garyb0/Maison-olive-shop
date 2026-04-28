describe("delivery mode helpers", () => {
  const previousFlag = process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED;
  });

  afterAll(() => {
    if (previousFlag === undefined) {
      delete process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED;
      return;
    }

    process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED = previousFlag;
  });

  it("defaults to legacy mode when the experimental flag is off", async () => {
    const { getDefaultDeliveryCheckoutMode, resolveDeliveryCheckoutMode } = await import(
      "@/lib/delivery-mode"
    );

    expect(getDefaultDeliveryCheckoutMode()).toBe("legacy");
    expect(resolveDeliveryCheckoutMode()).toBe("legacy");
    expect(resolveDeliveryCheckoutMode("dynamic")).toBe("legacy");
  });

  it("switches to dynamic mode when the experimental flag is on", async () => {
    process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED = "true";

    const { getDefaultDeliveryCheckoutMode, resolveDeliveryCheckoutMode } = await import(
      "@/lib/delivery-mode"
    );

    expect(getDefaultDeliveryCheckoutMode()).toBe("dynamic");
    expect(resolveDeliveryCheckoutMode()).toBe("dynamic");
    expect(resolveDeliveryCheckoutMode("dynamic")).toBe("dynamic");
    expect(resolveDeliveryCheckoutMode("legacy")).toBe("legacy");
  });
});
