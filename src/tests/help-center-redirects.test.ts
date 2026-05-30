vi.mock("../../scripts/db-utils", () => ({
  loadExternalSecretEnvForTarget: vi.fn(),
}));

describe("help center redirects", () => {
  it("redirige les anciennes pages visibles vers les sections FAQ", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const redirects = nextConfig.redirects ? await nextConfig.redirects() : [];

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/shipping",
          destination: "/faq#livraison",
          permanent: true,
        }),
        expect.objectContaining({
          source: "/returns",
          destination: "/faq#retours",
          permanent: true,
        }),
      ]),
    );
    expect(redirects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/terms",
        }),
      ]),
    );
  });
});
