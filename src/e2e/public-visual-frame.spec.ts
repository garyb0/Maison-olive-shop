import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1366, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const FRAME_TOLERANCE_PX = 2;

type ProductsPayload = {
  products?: Array<{
    slug: string;
    stock?: number;
    isActive?: boolean;
    variants?: Array<{
      stock?: number;
      isActive?: boolean;
    }>;
  }>;
};

type FrameBox = {
  x: number;
  width: number;
  right: number;
};

type FrameMetrics = {
  viewportWidth: number;
  documentWidth: number;
  bodyWidth: number;
  header: FrameBox;
  main: FrameBox;
  footer: FrameBox;
};

function hasAvailableStock(product: NonNullable<ProductsPayload["products"]>[number]) {
  const variantInStock = product.variants?.some((variant) =>
    variant.isActive !== false && (variant.stock ?? 0) > 0,
  );

  return Boolean(variantInStock) || (product.stock ?? 0) > 0;
}

async function getActiveProductSlug(request: APIRequestContext) {
  const response = await request.get("/api/products");
  expect(response.ok(), "products API response").toBe(true);

  const payload = (await response.json()) as ProductsPayload;
  const product = payload.products?.find((item) => item.isActive !== false && hasAvailableStock(item));

  expect(product?.slug, "an active in-stock product is required for visual frame checks").toBeTruthy();

  return product!.slug;
}

async function readFrameMetrics(page: Page, mainSelector: string) {
  await expect(page.locator(".nav-marketplace-main").first()).toBeVisible();
  await expect(page.locator(mainSelector).first()).toBeVisible();
  await expect(page.locator(".site-footer").first()).toBeAttached();
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true));

  return page.evaluate((selector): FrameMetrics => {
    const readBox = (targetSelector: string) => {
      const element = document.querySelector(targetSelector);
      if (!element) {
        throw new Error(`Missing frame element: ${targetSelector}`);
      }

      const rect = element.getBoundingClientRect();

      return {
        x: rect.x,
        width: rect.width,
        right: rect.right,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      header: readBox(".nav-marketplace-main"),
      main: readBox(selector),
      footer: readBox(".site-footer"),
    };
  }, mainSelector);
}

function expectClose(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(FRAME_TOLERANCE_PX);
}

function expectFrameClose(actual: FrameBox, expected: FrameBox, label: string) {
  expectClose(actual.x, expected.x, `${label} x`);
  expectClose(actual.width, expected.width, `${label} width`);
  expectClose(actual.right, expected.right, `${label} right`);
}

function expectNoHorizontalOverflow(metrics: FrameMetrics, label: string) {
  expect(metrics.documentWidth, `${label} document width`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, `${label} body width`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("public visual frame", () => {
  test.describe("desktop", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("home, shop and product pages keep the same frame", async ({ page, request }) => {
      const productSlug = await getActiveProductSlug(request);
      const routes = [
        { label: "home", path: "/?home=1", mainSelector: ".home-hero" },
        { label: "shop", path: "/boutique", mainSelector: ".catalog-section" },
        { label: "product", path: `/products/${productSlug}`, mainSelector: ".olive-product-page" },
      ];
      const frames: Array<{ label: string; metrics: FrameMetrics }> = [];

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState("domcontentloaded");

        const metrics = await readFrameMetrics(page, route.mainSelector);
        expectNoHorizontalOverflow(metrics, route.label);
        frames.push({ label: route.label, metrics });
      }

      const baseline = frames[0]!.metrics;

      for (const frame of frames.slice(1)) {
        expectFrameClose(frame.metrics.header, baseline.header, `${frame.label} header follows home`);
        expectFrameClose(frame.metrics.main, baseline.main, `${frame.label} main follows home`);
        expectFrameClose(frame.metrics.footer, baseline.footer, `${frame.label} footer follows home`);
      }
    });
  });

  test.describe("mobile", () => {
    test.use({
      viewport: MOBILE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
    });

    test("home, shop and product pages do not shift or overflow", async ({ page, request }) => {
      const productSlug = await getActiveProductSlug(request);
      const routes = [
        { label: "home", path: "/?home=1", mainSelector: ".home-hero" },
        { label: "shop", path: "/boutique", mainSelector: ".catalog-section" },
        { label: "product", path: `/products/${productSlug}`, mainSelector: ".olive-product-page" },
      ];
      const frames: Array<{ label: string; metrics: FrameMetrics }> = [];

      for (const route of routes) {
        await page.goto(route.path);
        await page.waitForLoadState("domcontentloaded");

        const metrics = await readFrameMetrics(page, route.mainSelector);
        expectNoHorizontalOverflow(metrics, route.label);
        frames.push({ label: route.label, metrics });
      }

      const baseline = frames[0]!.metrics;

      for (const frame of frames.slice(1)) {
        expectFrameClose(frame.metrics.header, baseline.header, `${frame.label} mobile header follows home`);
        expectFrameClose(frame.metrics.main, baseline.main, `${frame.label} mobile main follows home`);
        expectFrameClose(frame.metrics.footer, baseline.footer, `${frame.label} mobile footer follows home`);
      }
    });
  });
});
