import {
  CANADIAN_PROVINCE_OPTIONS,
  getAddressOptionLabel,
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
  it("affiche les provinces canadiennes avec les accents français attendus", () => {
    const labels = CANADIAN_PROVINCE_OPTIONS.map((option) =>
      getAddressOptionLabel(option, "fr"),
    );

    expect(labels).toContain("NS - Nouvelle-Écosse");
    expect(labels).toContain("PE - Île-du-Prince-Édouard");
    expect(labels).toContain("QC - Québec");
  });
});
