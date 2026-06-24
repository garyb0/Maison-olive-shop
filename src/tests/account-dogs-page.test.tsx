const redirectMock = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: (href: string) => redirectMock(href),
}));

describe("account dog page", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirige la surface QR client vers le compte", async () => {
    const { default: AccountDogsPage } = await import("@/app/account/dogs/page");

    expect(() => AccountDogsPage()).toThrow("redirect:/account");
    expect(redirectMock).toHaveBeenCalledWith("/account");
  });
});
