import { normalizeDogPublicTokenInput } from "@/lib/dog-token";

describe("dog QR token normalization", () => {
  it.each([
    ["dog-token-001", "dog-token-001"],
    [" QR: dog-token-001 ", "dog-token-001"],
    ["https://chezolive.ca/dog/dog-token-001?utm=print", "dog-token-001"],
    ["/dog/dog-token-001?activate=1", "dog-token-001"],
    ["chezolive.ca/dog/dog-token-001", "dog-token-001"],
    ["https://chezolive.ca/activate?publicToken=dog-token-001", "dog-token-001"],
  ])("normalise %s", (input, expected) => {
    expect(normalizeDogPublicTokenInput(input)).toBe(expected);
  });
});
