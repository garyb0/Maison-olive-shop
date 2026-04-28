import {
  isDeliveryRunsSchemaUnavailableError,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";

describe("delivery-runs error mapping", () => {
  it("detecte une vraie erreur de schema manquant", () => {
    const error = new Error("no such table: GeocodedAddressCache");

    expect(isDeliveryRunsSchemaUnavailableError(error)).toBe(true);
    expect(mapDeliveryRunError(error)).toEqual({
      message: "Delivery runs schema is unavailable. Run Prisma migrations first.",
      status: 503,
    });
  });

  it("ne confond pas un timeout de transaction avec un schema manquant", () => {
    const error = new Error(
      "Invalid `tx.deliveryStop.update()` invocation. Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms.",
    );

    expect(isDeliveryRunsSchemaUnavailableError(error)).toBe(false);
    expect(mapDeliveryRunError(error)).toEqual({
      message: "Unable to process the delivery run request.",
      status: 500,
    });
  });
});
