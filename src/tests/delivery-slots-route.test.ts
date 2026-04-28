const getCheckoutDeliverySlotsMock = vi.fn();

vi.mock("@/lib/delivery", () => ({
  getCheckoutDeliverySlots: (...args: unknown[]) => getCheckoutDeliverySlotsMock(...args),
}));

describe("GET /api/delivery/slots", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retourne les créneaux persistés filtrés pour le checkout", async () => {
    getCheckoutDeliverySlotsMock.mockResolvedValue({
      mode: "legacy",
      slots: [
        {
          id: "slot_1",
          startAt: "2026-04-11T12:00:00.000Z",
          endAt: "2026-04-11T14:00:00.000Z",
          capacity: 8,
          reservedCount: 3,
          remainingCapacity: 5,
          isOpen: true,
          note: "Route nord",
          dateKey: "2026-04-11",
        },
      ],
    });

    const { GET } = await import("@/app/api/delivery/slots/route");

    const res = await GET(
      new Request("http://localhost:3101/api/delivery/slots?postalCode=G5L+1A1&country=CA"),
    );
    const payload = (await res.json()) as {
      mode?: string;
      slots?: Array<{ id: string; remainingCapacity: number }>;
    };

    expect(res.status).toBe(200);
    expect(payload.mode).toBe("legacy");
    expect(payload.slots).toEqual([
      expect.objectContaining({
        id: "slot_1",
        remainingCapacity: 5,
      }),
    ]);
    expect(getCheckoutDeliverySlotsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: "G5L 1A1",
        country: "CA",
      }),
    );
  });

  it("retourne 400 si la query est invalide", async () => {
    const { GET } = await import("@/app/api/delivery/slots/route");

    const res = await GET(
      new Request("http://localhost:3101/api/delivery/slots?from=pas-une-date"),
    );
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe("Invalid query");
    expect(getCheckoutDeliverySlotsMock).not.toHaveBeenCalled();
  });
});
