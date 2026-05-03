import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type SandboxState = {
  driverUrl: string;
  token: string;
};

declare global {
  interface Window {
    __chezOliveLastOpenedUrl?: string;
    __chezOliveSetDriverLocation?: (location: { latitude: number; longitude: number; accuracy: number }) => void;
  }
}

const sandboxStatePath = process.env.DELIVERY_SANDBOX_STATE_PATH
  ? path.resolve(process.env.DELIVERY_SANDBOX_STATE_PATH)
  : path.join(process.cwd(), ".delivery-sandbox", "latest.json");

const screenshotDir = path.join(process.cwd(), "test-results", "delivery-driver-full-day");

function readSandboxState(): SandboxState {
  if (!fs.existsSync(sandboxStatePath)) {
    throw new Error(
      `Missing delivery sandbox state file: ${sandboxStatePath}. Run npm run delivery:sandbox:setup first.`,
    );
  }

  const state = JSON.parse(fs.readFileSync(sandboxStatePath, "utf8")) as Partial<SandboxState>;
  if (!state.driverUrl || !state.token) {
    throw new Error(`Invalid delivery sandbox state file: ${sandboxStatePath}`);
  }

  return {
    driverUrl: state.driverUrl,
    token: state.token,
  };
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(name, {
    path: screenshotPath,
    contentType: "image/png",
  });
}

test("recette visuelle journee complete du copilote livreur sandbox", async ({ context, page }, testInfo) => {
  test.setTimeout(120_000);

  const state = readSandboxState();
  const origin = new URL(state.driverUrl).origin;

  await context.grantPermissions(["geolocation"], { origin });
  await context.setGeolocation({
    latitude: 48.4521,
    longitude: -68.523,
    accuracy: 8,
  });

  await page.addInitScript((location) => {
    let currentLocation = location;
    let nextWatchId = 1;
    const watchers = new Map<number, PositionCallback>();
    const buildPosition = () => ({
      coords: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        altitude: null,
        accuracy: currentLocation.accuracy,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON() {
          return this;
        },
      },
      timestamp: Date.now(),
      toJSON() {
        return this;
      },
    }) as GeolocationPosition;

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          window.setTimeout(() => success(buildPosition()), 0);
        },
        watchPosition(success: PositionCallback) {
          const id = nextWatchId;
          nextWatchId += 1;
          watchers.set(id, success);
          window.setTimeout(() => success(buildPosition()), 25);
          return id;
        },
        clearWatch(id: number) {
          watchers.delete(id);
        },
      },
    });

    window.__chezOliveSetDriverLocation = (nextLocation) => {
      currentLocation = nextLocation;
      watchers.forEach((success) => success(buildPosition()));
    };

    window.__chezOliveLastOpenedUrl = "";
    window.open = (url) => {
      window.__chezOliveLastOpenedUrl = String(url ?? "");
      return null;
    };
  }, { latitude: 48.4521, longitude: -68.523, accuracy: 8 });

  await page.goto(state.driverUrl);

  await expect(page.getByRole("heading", { name: /Sandbox chauffeur Waze/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Démarrer la tournée/i })).toBeVisible();
  await capture(page, testInfo, "01-before-start-desktop");

  await page.getByRole("button", { name: /Démarrer la tournée/i }).click();
  await expect(page.getByRole("link", { name: /Ouvrir Waze/i })).toHaveAttribute("href", /waze\.com/);
  await expect(page.getByText(/Prochain arrêt/i)).toBeVisible();
  const runResponse = await page.request.get(`/api/driver/run/${state.token}`);
  expect(runResponse.ok(), "driver run API response").toBe(true);
  const runPayload = (await runResponse.json()) as {
    run?: {
      stops?: Array<{
        status: string;
        geocodedLat: number | null;
        geocodedLng: number | null;
      }>;
    };
  };
  const nextStopPoint = runPayload.run?.stops?.find((stop) => stop.status === "PENDING");
  expect(nextStopPoint?.geocodedLat, "next stop latitude").toEqual(expect.any(Number));
  expect(nextStopPoint?.geocodedLng, "next stop longitude").toEqual(expect.any(Number));
  await page.evaluate(
    (nextLocation) => window.__chezOliveSetDriverLocation?.(nextLocation),
    {
      latitude: nextStopPoint!.geocodedLat!,
      longitude: nextStopPoint!.geocodedLng!,
      accuracy: 8,
    },
  );
  await capture(page, testInfo, "02-cockpit-in-progress-desktop");

  await expect(page.getByText(/Tu sembles arriv/i)).toBeVisible();
  await capture(page, testInfo, "03-arrival-suggestion-desktop");

  await page.getByRole("button", { name: /Je suis arriv/i }).click();
  await expect(page.getByText(/Arrivee confirmee|Arrivée confirmée/i)).toBeVisible();

  await page.getByRole("button", { name: /optimiser depuis ma position/i }).click();
  await expect
    .poll(() => page.evaluate(() => window.__chezOliveLastOpenedUrl ?? ""))
    .toContain("waze.com");
  await capture(page, testInfo, "04-waze-reoptimize-desktop");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
  });
  await expect(page.locator(".driver-proof-upload").getByText(/Photo ajout/i)).toBeVisible();
  await capture(page, testInfo, "05-proof-photo-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, testInfo, "06-cockpit-mobile");

  await context.setOffline(true);
  await page.getByRole("button", { name: /^Livré$/i }).click();
  await expect(page.locator(".driver-queue-callout").getByText(/en attente de synchronisation/i)).toBeVisible();
  await capture(page, testInfo, "07-offline-queue-mobile");

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".driver-queue-callout")).toHaveCount(0);
  await expect(page.getByText(/Actions synchronis/i)).toBeVisible();
  await capture(page, testInfo, "08-after-sync-mobile");

  for (let index = 0; index < 6; index += 1) {
    const remainingDeliveredButtons = page.getByRole("button", { name: /Marquer livr|Mark delivered/i });
    const remainingCount = await remainingDeliveredButtons.count();
    if (remainingCount === 0) break;

    await remainingDeliveredButtons.first().click();
    await expect(page.getByText(/Arret marque comme livre|Stop marked as delivered/i)).toBeVisible();
  }

  await expect(page.getByText(/Tous les arr|All stops/i)).toBeVisible();
  await capture(page, testInfo, "09-all-stops-processed-mobile");

  await page.getByPlaceholder(/Odom/i).first().fill("12");
  await page.getByPlaceholder(/Odom/i).nth(1).fill("18.4");
  await page.getByPlaceholder(/Note de fin|Run completion/i).fill("Recette sandbox journee complete.");
  await page.getByRole("button", { name: /Terminer|Finish run/i }).click();
  await expect(page.getByText(/Tourn.*termin|Run finished/i)).toBeVisible();
  await capture(page, testInfo, "10-run-finished-mobile");
});
