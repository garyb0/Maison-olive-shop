import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DriverRunClient } from "@/app/driver/run/[token]/run-client";
import type { DeliveryRunSummary } from "@/lib/types";

const originalGeolocation = navigator.geolocation;

const baseRun: DeliveryRunSummary = {
  id: "run_1",
  status: "PUBLISHED",
  dateKey: "2026-04-28",
  includeReturnToDepot: true,
  plannedKm: 12.4,
  plannedDurationSec: 1800,
  actualKmGps: null,
  actualKmOdometer: null,
  actualKmFinal: null,
  actualKmSource: null,
  odometerStartKm: null,
  odometerEndKm: null,
  note: null,
  startedAt: null,
  completedAt: null,
  publishedAt: "2026-04-28T12:00:00.000Z",
  createdAt: "2026-04-28T12:00:00.000Z",
  updatedAt: "2026-04-28T12:00:00.000Z",
  driver: {
    id: "driver_1",
    name: "Chauffeur Test",
    phone: "4185551212",
    isActive: true,
    createdAt: "2026-04-28T12:00:00.000Z",
    updatedAt: "2026-04-28T12:00:00.000Z",
  },
  deliverySlot: {
    id: "slot_1",
    startAt: "2026-04-28T13:00:00.000Z",
    endAt: "2026-04-28T15:00:00.000Z",
    capacity: 4,
    note: null,
  },
  stops: [
    {
      id: "stop_1",
      orderId: "order_1",
      orderNumber: "MO-20260428-0001",
      customerName: "Client Invite",
      deliveryPhone: "4185551212",
      deliveryInstructions: "Laisser a la porte",
      shippingLine1: "22 rue Principale",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 1A1",
      shippingCountry: "CA",
      plannedSequence: 1,
      manualSequence: null,
      finalSequence: 1,
      status: "PENDING",
      plannedLegKm: 12.4,
      plannedCumulativeKm: 12.4,
      plannedLegDurationSec: 1800,
      plannedEta: "2026-04-28T13:30:00.000Z",
      actualCumulativeKmAtStop: null,
      arrivedAt: null,
      arrivedLat: null,
      arrivedLng: null,
      arrivedAccuracyMeters: null,
      arrivedDistanceMeters: null,
      completedAt: null,
      note: null,
      proofPhotoUrl: null,
      proofPhotoMime: null,
      proofPhotoSizeBytes: null,
      proofPhotoUploadedAt: null,
      proofPhotoLat: null,
      proofPhotoLng: null,
      proofPhotoAccuracyMeters: null,
      hasProofPhoto: false,
      geocodedLat: 48.4521,
      geocodedLng: -68.523,
      geocodedAt: "2026-04-28T12:00:00.000Z",
      mapsHref: "https://maps.google.com/?q=22%20rue%20Principale",
      wazeHref: "https://www.waze.com/ul?q=22%20rue%20Principale&navigate=yes",
    },
  ],
  stopCounts: {
    total: 1,
    pending: 1,
    delivered: 0,
    failed: 0,
  },
  accessToken: {
    hasActiveToken: true,
    expiresAt: "2026-05-28T12:00:00.000Z",
    revokedAt: null,
    lastAccessAt: null,
  },
  gpsSampleCount: 0,
};

describe("DriverRunClient French copy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it("affiche les libelles chauffeur en francais clair", () => {
    render(
      <DriverRunClient
        language="fr"
        token="token_1"
        gpsTrackingEnabled={false}
        pushPublicKey=""
        initialRun={baseRun}
      />,
    );

    expect(screen.getByText("Prête")).toBeInTheDocument();
    expect(screen.getByText("GPS en attente")).toBeInTheDocument();
    expect(screen.getByText("KM à confirmer")).toBeInTheDocument();
    expect(screen.getByText("Prévu")).toBeInTheDocument();
    expect(screen.getByText("Réel")).toBeInTheDocument();
    expect(screen.getByText("Arrêts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Démarrer la tournée" })).toBeEnabled();
    expect(screen.getByText("Prochain arrêt")).toBeInTheDocument();
    expect(screen.getAllByText("À faire").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Marquer livré" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Marquer échec" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Terminer la tournée" })).toBeDisabled();
    expect(screen.getByText("Démarre la tournée avant de la clôturer.")).toBeInTheDocument();
  });

  it("active le suivi GPS mobile et publie les positions quand la tournee est en cours", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const clearWatchMock = vi.fn();
    const watchPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 48.4521,
          longitude: -68.523,
          altitude: null,
          accuracy: 9,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: vi.fn(),
        },
        timestamp: Date.parse("2026-04-28T14:00:00.000Z"),
        toJSON: vi.fn(),
      });
      return 42;
    });

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
        getCurrentPosition: vi.fn(),
      },
    });

    const { unmount } = render(
      <DriverRunClient
        language="fr"
        token="token_1"
        gpsTrackingEnabled
        pushPublicKey=""
        initialRun={{ ...baseRun, status: "IN_PROGRESS" }}
      />,
    );

    await waitFor(() => expect(watchPositionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText("GPS actif")).toBeInTheDocument();
    expect(screen.getByText(/Tu sembles arriv/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/run/token_1/location",
      expect.objectContaining({ method: "POST" }),
    );

    const requestInit = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][1];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      lat: 48.4521,
      lng: -68.523,
      accuracyMeters: 9,
      recordedAt: "2026-04-28T14:00:00.000Z",
    });

    unmount();
    expect(clearWatchMock).toHaveBeenCalledWith(42);
  });

  it("met une action chauffeur en file si le reseau coupe", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Network disconnected");
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DriverRunClient
        language="fr"
        token="token_1"
        gpsTrackingEnabled={false}
        pushPublicKey=""
        initialRun={{ ...baseRun, status: "IN_PROGRESS" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Livré" }));

    await waitFor(() => expect(screen.getByText(/1 action.*en attente de synchronisation/i)).toBeInTheDocument());
    expect(window.localStorage.getItem("chezolive:driver-run-queue:token_1")).toContain("\"complete\"");
  });

  it("reoptimise les arrets actifs et ouvre Waze depuis le bouton chauffeur", async () => {
    const updatedRun: DeliveryRunSummary = {
      ...baseRun,
      status: "IN_PROGRESS",
      plannedKm: 8.2,
      stops: [
        {
          ...baseRun.stops[0],
          customerName: "Client Reordonne",
          plannedLegKm: 8.2,
          plannedCumulativeKm: 8.2,
          wazeHref: "https://www.waze.com/ul?q=Client%20Reordonne&navigate=yes",
        },
      ],
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        run: updatedRun,
        navigationHref: "https://www.waze.com/ul?q=Client%20Reordonne&navigate=yes",
        warning: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 48.4521,
          longitude: -68.523,
          altitude: null,
          accuracy: 9,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: vi.fn(),
        },
        timestamp: Date.parse("2026-04-28T14:05:00.000Z"),
        toJSON: vi.fn(),
      });
    });
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
        getCurrentPosition: getCurrentPositionMock,
      },
    });

    render(
      <DriverRunClient
        language="fr"
        token="token_1"
        gpsTrackingEnabled={false}
        pushPublicKey=""
        initialRun={{ ...baseRun, status: "IN_PROGRESS" }}
      />,
    );

    expect(screen.getByRole("button", { name: /optimiser depuis ma position/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /optimiser depuis ma position/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/run/token_1/optimize",
      expect.objectContaining({ method: "POST" }),
    ));

    const requestInit = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][1];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      lat: 48.4521,
      lng: -68.523,
      accuracyMeters: 9,
      recordedAt: "2026-04-28T14:05:00.000Z",
      navigationProvider: "WAZE",
    });
    await waitFor(() =>
      expect(openMock).toHaveBeenCalledWith("https://www.waze.com/ul?q=Client%20Reordonne&navigate=yes", "_self"),
    );
    expect(screen.getByText("Client Reordonne")).toBeInTheDocument();
  });

  it("active les alertes push tokenisees de la tournee sans les rendre obligatoires", async () => {
    const subscription = {
      endpoint: "https://push.example.test/driver/subscription",
      keys: {
        p256dh: "abcdefghijklmnopqrstuvwxyz123456",
        auth: "auth-token-123",
      },
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: this.keys,
        };
      },
    };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    const registration = { pushManager };
    const requestPermission = vi.fn().mockResolvedValue("granted");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, subscription: { enabled: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      },
    });

    render(
      <DriverRunClient
        language="fr"
        token="token_1"
        gpsTrackingEnabled={false}
        pushPublicKey="AQIDBA"
        initialRun={baseRun}
      />,
    );

    expect(screen.getByText("Recevoir les alertes de cette tournée")).toBeInTheDocument();
    expect(screen.getByText(/Tu peux livrer même sans l'activer/i)).toBeInTheDocument();
    const enableButton = await screen.findByRole("button", { name: "Recevoir les alertes" });
    fireEvent.click(enableButton);

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/driver/run/token_1/push/subscribe",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("Alertes de tournée activées.")).toBeInTheDocument();
  });
});
