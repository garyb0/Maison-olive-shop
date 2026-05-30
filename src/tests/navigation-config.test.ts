import {
  accountNavigationItems,
  adminNavigationGroups,
  appNavigationItems,
  getAdminMobileItems,
  publicNavigationItems,
} from "@/lib/navigation";

describe("navigation configuration", () => {
  it("expose les onglets attendus pour l'app client", () => {
    expect(appNavigationItems.map((item) => item.href)).toEqual([
      "/app",
      "/boutique",
      "/account/orders",
      "/account/support",
      "/account",
    ]);
    expect(appNavigationItems.every((item) => item.icon)).toBe(true);
  });

  it("garde les entrees publiques importantes visibles", () => {
    expect(publicNavigationItems.map((item) => item.href)).toEqual([
      "/?home=1",
      "/boutique",
      "/app",
      "/faq",
    ]);
  });

  it("structure le compte autour des commandes, chiens QR, abonnements, profil et support", () => {
    expect(accountNavigationItems.map((item) => item.href)).toEqual([
      "/account",
      "/account/orders",
      "/account/dogs",
      "/account/subscriptions",
      "/account/profile",
      "/account/support",
    ]);
  });

  it("regroupe l'admin par logique metier et expose les enfants en mobile", () => {
    expect(adminNavigationGroups.map((group) => group.id)).toEqual([
      "dashboard",
      "sales",
      "catalog",
      "delivery",
      "customers",
      "ops",
    ]);

    const mobileHrefs = getAdminMobileItems("fr").map((item) => item.href);
    expect(mobileHrefs).toContain("/admin/products");
    expect(mobileHrefs).toContain("/admin/delivery/runs");
    expect(mobileHrefs).toContain("/admin/support/settings");
    expect(new Set(mobileHrefs).size).toBe(mobileHrefs.length);
  });
});
