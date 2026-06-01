export {};

describe("sanitizeGoogleOAuthReturnTo", () => {
  it("accepte uniquement les chemins locaux normalises", async () => {
    const { sanitizeGoogleOAuthReturnTo } = await import("@/lib/google-oauth");

    expect(sanitizeGoogleOAuthReturnTo("/checkout?step=payment#card")).toBe("/checkout?step=payment#card");
    expect(sanitizeGoogleOAuthReturnTo("https://evil.example/path")).toBe("/account");
    expect(sanitizeGoogleOAuthReturnTo("//evil.example/path")).toBe("/account");
    expect(sanitizeGoogleOAuthReturnTo("/\\evil.example/path")).toBe("/account");
    expect(sanitizeGoogleOAuthReturnTo("/%5C%5Cevil.example/path")).toBe("/account");
    expect(sanitizeGoogleOAuthReturnTo("/checkout\r\nSet-Cookie:bad=true")).toBe("/account");
  });
});
