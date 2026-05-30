import { expect, test, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(metrics.documentWidth, "document must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, "body must not overflow horizontally").toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function expectLoginChrome(page: Page) {
  await expect(page.locator(".login-page")).toBeVisible();
  await expect(page.locator(".login-auth-frame")).toBeVisible();
  await expect(page.locator(".login-panel--signin")).toBeVisible();
  await expect(page.locator(".login-panel--register")).toBeVisible();
  await expect(page.locator(".login-support-tile")).toBeVisible();
  await expect(page.locator("#login-title")).toBeVisible();
  await expect(page.locator("#register-title")).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

async function expectNoSigninPhoto(page: Page) {
  const backgroundImage = await page.locator(".login-panel--signin").evaluate((element) => {
    return window.getComputedStyle(element).backgroundImage;
  });

  expect(backgroundImage, "signin panel must not use the family-dogs photo").not.toContain("family-dogs");
  expect(backgroundImage, "signin panel must not use any bitmap url").not.toContain("url(");
}

async function expectLoginVerticalMargins(page: Page) {
  const metrics = await page.evaluate(() => {
    const topbar = document.querySelector(".topbar")?.getBoundingClientRect();
    const frame = document.querySelector(".login-auth-frame")?.getBoundingClientRect();
    const supportTile = document.querySelector(".login-support-tile")?.getBoundingClientRect();
    const footer = document.querySelector(".site-footer-wrap")?.getBoundingClientRect();
    return {
      topGap: topbar && frame ? frame.top - topbar.bottom : null,
      bottomGap: supportTile && footer ? footer.top - supportTile.bottom : null,
    };
  });

  expect(metrics.topGap, "gap between topbar and auth frame should be measurable").not.toBeNull();
  expect(metrics.bottomGap, "gap between support tile and footer should be measurable").not.toBeNull();
  expect(metrics.topGap!, "login top margin").toBeGreaterThanOrEqual(16);
  expect(metrics.topGap!, "login top margin").toBeLessThanOrEqual(28);
  expect(metrics.bottomGap!, "login bottom margin").toBeGreaterThanOrEqual(20);
  expect(metrics.bottomGap!, "login bottom margin").toBeLessThanOrEqual(32);
}

async function expectLoginFollowsPageWidth(page: Page) {
  const metrics = await page.evaluate(() => {
    const readRect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    return {
      viewportWidth: window.innerWidth,
      topbar: readRect(".topbar"),
      frame: readRect(".login-auth-frame"),
      grid: readRect(".login-auth-grid"),
      footer: readRect(".site-footer"),
      supportTile: readRect(".login-support-tile"),
    };
  });

  expect(metrics.topbar, "topbar should be measurable").not.toBeNull();
  expect(metrics.frame, "auth frame should be measurable").not.toBeNull();
  expect(metrics.grid, "auth grid should be measurable").not.toBeNull();
  expect(metrics.footer, "footer should be measurable").not.toBeNull();
  expect(metrics.supportTile, "support tile should be measurable").not.toBeNull();

  expect(Math.abs(metrics.frame!.x - metrics.topbar!.x), "auth frame left edge follows topbar").toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.frame!.width - metrics.topbar!.width), "auth frame width follows topbar").toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.frame!.x - metrics.footer!.x), "auth frame left edge follows footer").toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.frame!.width - metrics.footer!.width), "auth frame width follows footer").toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.supportTile!.x - metrics.frame!.x), "support tile spans from frame left edge").toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.supportTile!.width - metrics.frame!.width), "support tile spans the full frame width").toBeLessThanOrEqual(1);

  if (metrics.viewportWidth >= 901) {
    const gridLeftInset = metrics.grid!.x - metrics.frame!.x;
    const gridRightInset = metrics.frame!.x + metrics.frame!.width - (metrics.grid!.x + metrics.grid!.width);

    expect(metrics.grid!.width, "desktop inner auth grid keeps the wider edge-weighted format").toBeLessThanOrEqual(1305);
    expect(metrics.grid!.width, "desktop inner auth grid remains substantial").toBeGreaterThanOrEqual(1050);
    expect(Math.abs(gridLeftInset - gridRightInset), "desktop inner auth grid is centered in the frame").toBeLessThanOrEqual(2);
    expect(metrics.frame!.width - metrics.grid!.width, "desktop frame still breathes around the auth grid").toBeGreaterThan(80);
    expect(metrics.frame!.width - metrics.grid!.width, "desktop auth grid stays close to frame edges").toBeLessThan(125);
  }
}

async function expectDesktopSplit(page: Page) {
  const boxes = await page.evaluate(() => {
    const signin = document.querySelector(".login-panel--signin")?.getBoundingClientRect();
    const register = document.querySelector(".login-panel--register")?.getBoundingClientRect();
    const frame = document.querySelector(".login-auth-frame")?.getBoundingClientRect();
    const connector = document.querySelector(".login-auth-connector");
    const connectorRect = connector?.getBoundingClientRect();
    const connectorStyle = connector ? window.getComputedStyle(connector) : null;
    const supportTile = document.querySelector(".login-support-tile")?.getBoundingClientRect();
    const support = document.querySelector(".support-lite-float");

    return {
      signin: signin ? { x: signin.x, y: signin.y, width: signin.width, height: signin.height } : null,
      register: register ? { x: register.x, y: register.y, width: register.width, height: register.height } : null,
      frame: frame ? { x: frame.x, y: frame.y, width: frame.width, height: frame.height } : null,
      connector: connectorRect ? { x: connectorRect.x, y: connectorRect.y, width: connectorRect.width, height: connectorRect.height } : null,
      connectorDisplay: connectorStyle?.display ?? null,
      connectorVisibility: connectorStyle?.visibility ?? null,
      supportTile: supportTile ? { x: supportTile.x, y: supportTile.y, width: supportTile.width, height: supportTile.height } : null,
      supportDisplay: support ? window.getComputedStyle(support).display : null,
    };
  });

  expect(boxes.signin, "signin panel should be measurable").not.toBeNull();
  expect(boxes.register, "register panel should be measurable").not.toBeNull();
  expect(boxes.frame, "auth frame should be measurable").not.toBeNull();
  expect(boxes.connector, "desktop auth connector should be measurable").not.toBeNull();
  expect(boxes.supportTile, "support tile should be measurable").not.toBeNull();
  expect(boxes.signin!.width, "desktop signin panel width").toBeGreaterThan(500);
  expect(boxes.signin!.width, "desktop signin panel stretches toward the center").toBeGreaterThan(620);
  expect(boxes.signin!.width, "desktop signin panel should not become full-bleed").toBeLessThan(645);
  expect(boxes.register!.width, "desktop register panel width").toBeGreaterThan(430);
  expect(boxes.register!.width, "desktop register panel stretches toward the center").toBeGreaterThan(620);
  expect(boxes.register!.width, "desktop register panel should not become full-bleed").toBeLessThan(645);
  expect(boxes.signin!.x + boxes.signin!.width, "register panel must sit to the right of signin").toBeLessThan(boxes.register!.x);
  const panelGap = boxes.register!.x - (boxes.signin!.x + boxes.signin!.width);
  expect(panelGap, "desktop auth panels keep a modest middle opening").toBeGreaterThanOrEqual(40);
  expect(panelGap, "desktop auth panels should not open too much in the middle").toBeLessThanOrEqual(52);
  expect(boxes.connectorDisplay, "desktop auth connector should be visible").not.toBe("none");
  expect(boxes.connectorVisibility, "desktop auth connector should not be hidden").toBe("visible");
  expect(Math.abs(boxes.connector!.x - (boxes.signin!.x + boxes.signin!.width)), "connector starts at signin edge").toBeLessThanOrEqual(2);
  expect(Math.abs(boxes.connector!.x + boxes.connector!.width - boxes.register!.x), "connector reaches register edge").toBeLessThanOrEqual(2);
  expect(Math.abs(boxes.connector!.width - panelGap), "connector spans the whole gap").toBeLessThanOrEqual(2);
  expect(boxes.connector!.height, "connector has a visible vertical spine").toBeGreaterThan(240);
  expect(Math.abs(boxes.signin!.y - boxes.register!.y), "desktop panels should align on the same row").toBeLessThanOrEqual(4);
  expect(boxes.supportTile!.y, "support tile must sit under the auth frame").toBeGreaterThan(boxes.frame!.y + boxes.frame!.height);
  expect(boxes.supportDisplay, "support launcher should not cover login").toBe("none");
  await expectNoSigninPhoto(page);
  await expectLoginFollowsPageWidth(page);
  await expectLoginVerticalMargins(page);
}

async function expectMobileStack(page: Page) {
  const boxes = await page.evaluate(() => {
    const signin = document.querySelector(".login-panel--signin")?.getBoundingClientRect();
    const register = document.querySelector(".login-panel--register")?.getBoundingClientRect();
    const frame = document.querySelector(".login-auth-frame")?.getBoundingClientRect();
    const connector = document.querySelector(".login-auth-connector");
    const connectorStyle = connector ? window.getComputedStyle(connector) : null;
    const supportTile = document.querySelector(".login-support-tile")?.getBoundingClientRect();

    return {
      signin: signin ? { x: signin.x, y: signin.y, width: signin.width, height: signin.height } : null,
      register: register ? { x: register.x, y: register.y, width: register.width, height: register.height } : null,
      frame: frame ? { x: frame.x, y: frame.y, width: frame.width, height: frame.height } : null,
      connectorDisplay: connectorStyle?.display ?? null,
      supportTile: supportTile ? { x: supportTile.x, y: supportTile.y, width: supportTile.width, height: supportTile.height } : null,
    };
  });

  expect(boxes.signin, "mobile signin panel should be measurable").not.toBeNull();
  expect(boxes.register, "mobile register panel should be measurable").not.toBeNull();
  expect(boxes.frame, "mobile auth frame should be measurable").not.toBeNull();
  expect(boxes.supportTile, "mobile support tile should be measurable").not.toBeNull();
  expect(boxes.signin!.width, "mobile signin panel stays within viewport").toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  expect(boxes.register!.width, "mobile register panel stays within viewport").toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  expect(boxes.register!.y, "register panel stacks below signin on mobile").toBeGreaterThan(boxes.signin!.y + boxes.signin!.height);
  expect(boxes.connectorDisplay, "auth connector stays hidden on mobile").toBe("none");
  expect(boxes.supportTile!.y, "support tile stacks below the auth frame on mobile").toBeGreaterThan(
    boxes.frame!.y + boxes.frame!.height,
  );
  await expectNoSigninPhoto(page);
  await expectLoginFollowsPageWidth(page);
  await expectLoginVerticalMargins(page);
}

test.describe("login navigation and layout contract", () => {
  test("desktop public navigation opens login and browser back/forward preserves layout", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);

    await page.goto("/boutique");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/boutique/);

    await page.locator(".nav-marketplace-account-trigger").click();
    await page.locator(".nav-marketplace-account-popover a[href='/login']").click();
    await expect(page).toHaveURL(/\/login$/);
    await expectLoginChrome(page);
    await expectDesktopSplit(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/boutique/);
    await expectNoHorizontalOverflow(page);

    await page.goForward();
    await expect(page).toHaveURL(/\/login$/);
    await expectLoginChrome(page);
    await expectDesktopSplit(page);
  });

  test("manual registration honors returnTo without touching the real database", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    let registerBody: Record<string, unknown> | null = null;

    await page.route("**/api/auth/register", async (route) => {
      registerBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-user",
          email: registerBody.email,
          firstName: registerBody.firstName,
          lastName: registerBody.lastName,
          role: "CUSTOMER",
        }),
      });
    });

    await page.goto("/login?returnTo=%2Fcheckout");
    await page.waitForLoadState("domcontentloaded");
    await expectLoginChrome(page);
    await expectDesktopSplit(page);

    const registerPanel = page.locator(".login-panel--register");
    await registerPanel.locator("#register-first-name").fill("Olive");
    await registerPanel.locator("#register-last-name").fill("Client");
    await registerPanel.locator("#register-email").fill("olive.navigation@example.com");
    await registerPanel.locator("#register-password").fill("password123");
    await registerPanel.getByRole("button", { name: /Créer mon compte|Create my account/i }).click();

    await expect(page).toHaveURL(/\/checkout/);
    expect(registerBody).toMatchObject({
      email: "olive.navigation@example.com",
      password: "password123",
      firstName: "Olive",
      lastName: "Client",
      language: "fr",
      autoLogin: true,
    });
  });

  test("mobile login stacks cleanly and survives browser navigation", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await expectLoginChrome(page);
    await expectMobileStack(page);

    await page.goto("/forgot-password");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /Mot de passe|password/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expectLoginChrome(page);
    await expectMobileStack(page);
  });
});
