export {};

const requireAdminMock = vi.fn();
const exportDeliveryRunCsvMock = vi.fn();
const getDeliveryRunDetailMock = vi.fn();
const publishDeliveryRunMock = vi.fn();
const optimizeDeliveryRunMock = vi.fn();
const reorderDeliveryRunMock = vi.fn();
const completeDeliveryRunFromAdminMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/delivery-runs", () => ({
  exportDeliveryRunCsv: (...args: unknown[]) => exportDeliveryRunCsvMock(...args),
  getDeliveryRunDetail: (...args: unknown[]) => getDeliveryRunDetailMock(...args),
  publishDeliveryRun: (...args: unknown[]) => publishDeliveryRunMock(...args),
  optimizeDeliveryRun: (...args: unknown[]) => optimizeDeliveryRunMock(...args),
  reorderDeliveryRun: (...args: unknown[]) => reorderDeliveryRunMock(...args),
  completeDeliveryRunFromAdmin: (...args: unknown[]) => completeDeliveryRunFromAdminMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status: 500,
  }),
}));

describe("admin delivery run action routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
  });

  it("retourne le detail JSON d'une tournee", async () => {
    getDeliveryRunDetailMock.mockResolvedValueOnce({ id: "run_1" });
    const { GET } = await import("@/app/api/admin/delivery/runs/[runId]/route");

    const response = await GET(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1"),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { run?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(getDeliveryRunDetailMock).toHaveBeenCalledWith("run_1");
  });

  it("exporte une tournee au format CSV", async () => {
    exportDeliveryRunCsvMock.mockResolvedValueOnce("runId,orderNumber\nrun_1,MO-1");
    const { GET } = await import("@/app/api/admin/delivery/runs/[runId]/route");

    const response = await GET(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1?format=csv"),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(payload).toContain("run_1,MO-1");
    expect(exportDeliveryRunCsvMock).toHaveBeenCalledWith("run_1");
  });

  it("publie une tournee et renvoie le lien chauffeur", async () => {
    publishDeliveryRunMock.mockResolvedValueOnce({
      run: { id: "run_1", status: "PUBLISHED" },
      driverUrl: "https://chezolive.local/driver/run/token",
    });
    const { POST } = await import("@/app/api/admin/delivery/runs/[runId]/publish/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { run?: { id: string }; driverUrl?: string };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(payload.driverUrl).toContain("/driver/run/");
    expect(publishDeliveryRunMock).toHaveBeenCalledWith({
      runId: "run_1",
      actorUserId: "admin_1",
    });
  });

  it("optimise une tournee et transmet l'avertissement de fallback", async () => {
    optimizeDeliveryRunMock.mockResolvedValueOnce({
      run: { id: "run_1", plannedKm: null },
      warning: "Google Maps indisponible",
    });
    const { POST } = await import("@/app/api/admin/delivery/runs/[runId]/optimize/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1/optimize", {
        method: "POST",
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { run?: { id: string }; warning?: string };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(payload.warning).toBe("Google Maps indisponible");
    expect(optimizeDeliveryRunMock).toHaveBeenCalledWith({
      runId: "run_1",
      actorUserId: "admin_1",
    });
  });

  it("reordonne les arrets d'une tournee", async () => {
    reorderDeliveryRunMock.mockResolvedValueOnce({
      run: { id: "run_1" },
      warning: null,
    });
    const { PATCH } = await import("@/app/api/admin/delivery/runs/[runId]/reorder/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stopIds: ["stop_2", "stop_1"],
        }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { run?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(reorderDeliveryRunMock).toHaveBeenCalledWith({
      runId: "run_1",
      stopIds: ["stop_2", "stop_1"],
      actorUserId: "admin_1",
    });
  });

  it("cloture une tournee depuis l'admin", async () => {
    completeDeliveryRunFromAdminMock.mockResolvedValueOnce({
      id: "run_1",
      actualKmFinal: 12.4,
    });
    const { POST } = await import("@/app/api/admin/delivery/runs/[runId]/complete/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manualActualKmFinal: 12.4,
          note: "Fin de tournee",
        }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { run?: { id: string; actualKmFinal: number } };

    expect(response.status).toBe(200);
    expect(payload.run).toEqual(
      expect.objectContaining({
        id: "run_1",
        actualKmFinal: 12.4,
      }),
    );
    expect(completeDeliveryRunFromAdminMock).toHaveBeenCalledWith({
      runId: "run_1",
      manualActualKmFinal: 12.4,
      note: "Fin de tournee",
      actorUserId: "admin_1",
    });
  });

  it("retourne 400 si le payload de reorder est invalide", async () => {
    const { PATCH } = await import("@/app/api/admin/delivery/runs/[runId]/reorder/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/delivery/runs/run_1/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stopIds: [],
        }),
      }),
      { params: Promise.resolve({ runId: "run_1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid reorder payload");
    expect(reorderDeliveryRunMock).not.toHaveBeenCalled();
  });
});
