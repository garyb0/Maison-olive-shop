const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();

vi.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
    unlinkSync: (...args: unknown[]) => unlinkSyncMock(...args),
  },
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
  unlinkSync: (...args: unknown[]) => unlinkSyncMock(...args),
}));

describe("maintenance lib", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.MAINTENANCE_MODE;
  });

  it("retourne enabled=true via fallback env quand lock absent", async () => {
    existsSyncMock.mockReturnValue(false);
    process.env.MAINTENANCE_MODE = "true";

    const { getMaintenanceState } = await import("@/lib/maintenance");
    const state = getMaintenanceState();
    const second = getMaintenanceState();

    expect(state.enabled).toBe(true);
    expect(state.message).toBeNull();
    expect(second.enabled).toBe(true);
    expect(existsSyncMock).toHaveBeenCalledTimes(1);
  });

  it("lit correctement le lock file quand présent", async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        enabled: true,
        message: "maintenance",
        openAt: "2030-01-01T00:00:00.000Z",
        updatedAt: "2030-01-01T00:00:00.000Z",
        updatedBy: "admin@chez-olive.local",
      })
    );

    const { getMaintenanceState } = await import("@/lib/maintenance");
    const state = getMaintenanceState();

    expect(state.enabled).toBe(true);
    expect(state.message).toBe("maintenance");
    expect(state.openAt).toBeInstanceOf(Date);
    expect(state.updatedAt).toBeInstanceOf(Date);
  });

  it("setMaintenanceState(true) écrit le lock file", async () => {
    existsSyncMock.mockReturnValue(false);

    const { setMaintenanceState } = await import("@/lib/maintenance");
    const state = setMaintenanceState(true, { message: "planned" });

    expect(state.enabled).toBe(true);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });

  it("setMaintenanceState(false) supprime le lock file s'il existe", async () => {
    existsSyncMock.mockReturnValue(true);

    const { setMaintenanceState } = await import("@/lib/maintenance");
    const state = setMaintenanceState(false);

    expect(state.enabled).toBe(false);
    expect(unlinkSyncMock).toHaveBeenCalledTimes(1);
  });

  it("auto-réouvre si openAt est dépassé", async () => {
    const nowIso = new Date(Date.now() - 60_000).toISOString();

    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(
      JSON.stringify({
        enabled: true,
        message: "scheduled",
        openAt: nowIso,
        updatedAt: nowIso,
        updatedBy: "admin@chez-olive.local",
      })
    );

    const { getMaintenanceState } = await import("@/lib/maintenance");
    const state = getMaintenanceState();

    expect(state.enabled).toBe(false);
    expect(unlinkSyncMock).toHaveBeenCalledTimes(1);
  });
});
