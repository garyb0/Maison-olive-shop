import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.use({
  viewport: MOBILE_VIEWPORT,
  isMobile: true,
  hasTouch: true,
});

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(metrics.documentWidth, "document must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, "body must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("Chez Olive PWA app hub", () => {
  test("manifest is served with app start_url and icons", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(payload.start_url).toBe("/app");
    expect(payload.display).toBe("standalone");
    expect(payload.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/pwa-icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/pwa-maskable-512.png", purpose: "maskable" }),
      ]),
    );
  });

  test("mobile hub renders the final guest app structure", async ({ page }) => {
    await page.addInitScript(() => {
      const originalAddEventListener = window.addEventListener.bind(window);
      const patchedAddEventListener = (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        originalAddEventListener(type, listener as EventListener, options);
        if (type !== "beforeinstallprompt" || typeof listener !== "function") return;

        const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: "accepted"; platform: string }>;
        };
        Object.defineProperty(event, "prompt", { value: async () => undefined });
        Object.defineProperty(event, "userChoice", {
          value: Promise.resolve({ outcome: "accepted", platform: "web" }),
        });
        window.setTimeout(() => listener(event), 0);
      };
      window.addEventListener = patchedAddEventListener as typeof window.addEventListener;
    });

    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Bienvenue" })).toBeVisible();
    await expect(page.getByRole("banner", { name: "En-tete application" })).toBeVisible();
    await expect(page.locator(".nav-marketplace")).toHaveCount(0);
    await expect(page.locator(".pwa-app-header")).toBeVisible();
    await expect(page.getByRole("link", { name: "Boutique" }).first()).toHaveAttribute("href", "/boutique");
    await expect(page.getByRole("heading", { name: "Bienvenue chez Olive" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Magasiner chez Olive" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Magasiner/i }).first()).toHaveAttribute("href", "/boutique");
    await expect(page.getByRole("link", { name: /Me connecter|Connexion/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Centre d'actions" })).toHaveCount(0);
    await expect(page.locator(".pwa-core-action-grid a, .pwa-core-action-grid button")).toHaveCount(4);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({ path: "test-results/pwa-app-mobile.png", fullPage: true });
  });

  test("standalone display mode keeps safe app copy", async ({ page }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      };
    });

    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator(".pwa-app-header")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Bienvenue|Welcome/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Centre d'actions" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/pwa-app-standalone-mobile.png", fullPage: true });
  });

  test("offline page stays simple and avoids sensitive cached flows", async ({ page }) => {
    await page.goto("/offline");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Mode hors ligne" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour a l'app" })).toHaveAttribute("href", "/app");
    await expect(page.getByText("Checkout protege")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/pwa-offline-mobile.png", fullPage: true });
  });
});
