import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";

describe("delivery zone helpers", () => {
  it("accepte une adresse Rimouski (G5L, Canada)", () => {
    expect(
      isRimouskiDeliveryAddress({
        postalCode: "G5L 8Y7",
        country: "CA",
      })
    ).toBe(true);
  });

  it("refuse une adresse hors zone (postal différent)", () => {
    expect(
      isRimouskiDeliveryAddress({
        postalCode: "H2X 1Y4",
        country: "CA",
      })
    ).toBe(false);
  });

  it("refuse une adresse hors Canada", () => {
    expect(
      isRimouskiDeliveryAddress({
        postalCode: "G5L 8Y7",
        country: "US",
      })
    ).toBe(false);
  });
});
