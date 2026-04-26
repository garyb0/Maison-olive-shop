import {
  normalizeCountryCode,
  normalizePostalCodeInput,
  normalizeProvinceCode,
} from "@/lib/address-fields";

describe("address fields helpers", () => {
  it("normalise le code postal canadien en format compact majuscule", () => {
    expect(normalizePostalCodeInput("g0l 1b3")).toBe("G0L1B3");
    expect(normalizePostalCodeInput(" g0l-1b3 ")).toBe("G0L1B3");
  });

  it("normalise les aliases de province et de pays", () => {
    expect(normalizeProvinceCode("Québec")).toBe("QC");
    expect(normalizeProvinceCode("qc")).toBe("QC");
    expect(normalizeCountryCode("Canada")).toBe("CA");
    expect(normalizeCountryCode("ca")).toBe("CA");
  });
});
