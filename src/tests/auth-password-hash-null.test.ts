export {};

import { verifyPassword } from "@/lib/auth";

describe("verifyPassword", () => {
  it("refuse proprement un compte sans mot de passe local", async () => {
    await expect(verifyPassword("secret", null)).resolves.toBe(false);
    await expect(verifyPassword("secret", undefined)).resolves.toBe(false);
  });
});
