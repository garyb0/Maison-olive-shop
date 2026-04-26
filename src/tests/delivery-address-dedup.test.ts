import { normalizeDeliveryAddressIdentity } from "@/lib/delivery-addresses";

describe("normalizeDeliveryAddressIdentity", () => {
  it("normalise les variations de casse et d'espacement", () => {
    expect(
      normalizeDeliveryAddressIdentity({
        shippingLine1: " 123  Rue Olive ",
        shippingCity: " Rimouski ",
        shippingRegion: " qc ",
        shippingPostal: "g5l 1a1",
        shippingCountry: " ca ",
      }),
    ).toEqual(
      normalizeDeliveryAddressIdentity({
        shippingLine1: "123 rue olive",
        shippingCity: "RIMOUSKI",
        shippingRegion: "QC",
        shippingPostal: "G5L1A1",
        shippingCountry: "CA",
      }),
    );
  });
});
