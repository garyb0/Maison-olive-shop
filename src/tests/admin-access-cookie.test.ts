import {
  createAdminAccessCookieValue,
  verifyAdminAccessCookieValue,
} from "@/lib/admin-access-cookie";

describe("admin access cookie", () => {
  it("valide un cookie signe lie au token de session", async () => {
    const cookieValue = await createAdminAccessCookieValue({
      sessionToken: "session_123",
      expiresAt: new Date(Date.now() + 60_000),
      secret: "super-secret",
    });

    await expect(
      verifyAdminAccessCookieValue({
        cookieValue,
        sessionToken: "session_123",
        secret: "super-secret",
      }),
    ).resolves.toBe(true);
  });

  it("refuse un mauvais token de session", async () => {
    const cookieValue = await createAdminAccessCookieValue({
      sessionToken: "session_123",
      expiresAt: new Date(Date.now() + 60_000),
      secret: "super-secret",
    });

    await expect(
      verifyAdminAccessCookieValue({
        cookieValue,
        sessionToken: "other_session",
        secret: "super-secret",
      }),
    ).resolves.toBe(false);
  });

  it("refuse un cookie expire ou falsifie", async () => {
    const expiredCookie = await createAdminAccessCookieValue({
      sessionToken: "session_123",
      expiresAt: new Date(Date.now() - 60_000),
      secret: "super-secret",
    });

    await expect(
      verifyAdminAccessCookieValue({
        cookieValue: expiredCookie,
        sessionToken: "session_123",
        secret: "super-secret",
      }),
    ).resolves.toBe(false);

    await expect(
      verifyAdminAccessCookieValue({
        cookieValue: `${expiredCookie}x`,
        sessionToken: "session_123",
        secret: "super-secret",
      }),
    ).resolves.toBe(false);
  });
});
