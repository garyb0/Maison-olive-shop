export {}

const requireUserMock = vi.fn();
const getDeliveryAddressesForUserMock = vi.fn();
const createDeliveryAddressForUserMock = vi.fn();
const updateDeliveryAddressForUserMock = vi.fn();
const deleteDeliveryAddressForUserMock = vi.fn();
class DeliveryAddressDuplicateError extends Error {
  addressId: string;

  constructor(addressId = "addr_existing") {
    super("DELIVERY_ADDRESS_DUPLICATE");
    this.addressId = addressId;
  }
}

class DeliveryAddressLimitError extends Error {
  limit: number;

  constructor(limit = 3) {
    super("DELIVERY_ADDRESS_LIMIT_REACHED");
    this.limit = limit;
  }
}

class DeliveryAddressIncompleteError extends Error {
  constructor() {
    super("DELIVERY_ADDRESS_INCOMPLETE");
  }
}

vi.mock("@/lib/permissions", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/delivery-addresses", () => ({
  getDeliveryAddressesForUser: (...args: unknown[]) => getDeliveryAddressesForUserMock(...args),
  createDeliveryAddressForUser: (...args: unknown[]) => createDeliveryAddressForUserMock(...args),
  updateDeliveryAddressForUser: (...args: unknown[]) => updateDeliveryAddressForUserMock(...args),
  deleteDeliveryAddressForUser: (...args: unknown[]) => deleteDeliveryAddressForUserMock(...args),
  DeliveryAddressDuplicateError,
  DeliveryAddressLimitError,
  DeliveryAddressIncompleteError,
  MAX_DELIVERY_ADDRESSES_PER_USER: 3,
  DeliveryAddressValidationError: class DeliveryAddressValidationError extends Error {
    constructor() {
      super("OUTSIDE_DELIVERY_ZONE");
    }
  },
  DeliveryAddressOwnershipError: class DeliveryAddressOwnershipError extends Error {
    constructor() {
      super("DELIVERY_ADDRESS_NOT_FOUND");
    }
  },
}));

describe("delivery address account routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user_1" });
  });

  it("retourne les adresses du client", async () => {
    getDeliveryAddressesForUserMock.mockResolvedValue([
      { id: "addr_1", label: "Maison" },
      { id: "addr_2", label: "Travail" },
    ]);

    const { GET } = await import("@/app/api/account/delivery-addresses/route");
    const res = await GET();
    const payload = (await res.json()) as { addresses?: Array<{ id: string }> };

    expect(res.status).toBe(200);
    expect(payload.addresses).toHaveLength(2);
    expect(getDeliveryAddressesForUserMock).toHaveBeenCalledWith("user_1");
  });

  it("cree une adresse valide", async () => {
    createDeliveryAddressForUserMock.mockResolvedValue({
      id: "addr_1",
      label: "Maison",
      shippingLine1: "123 rue Olive",
    });

    const { POST } = await import("@/app/api/account/delivery-addresses/route");
    const req = new Request("http://localhost:3101/api/account/delivery-addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Maison",
        shippingLine1: "123 rue Olive",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G5L 1A1",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { address?: { label: string } };

    expect(res.status).toBe(200);
    expect(payload.address?.label).toBe("Maison");
    expect(createDeliveryAddressForUserMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ label: "Maison" }),
    );
  });

  it("modifie puis supprime une adresse", async () => {
    updateDeliveryAddressForUserMock.mockResolvedValue({
      id: "addr_1",
      label: "Travail",
    });
    deleteDeliveryAddressForUserMock.mockResolvedValue(undefined);

    const { PATCH, DELETE } = await import("@/app/api/account/delivery-addresses/[id]/route");

    const patchReq = new Request("http://localhost:3101/api/account/delivery-addresses/addr_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Travail" }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: "addr_1" }) });
    const patchPayload = (await patchRes.json()) as { address?: { label: string } };

    expect(patchRes.status).toBe(200);
    expect(patchPayload.address?.label).toBe("Travail");

    const deleteRes = await DELETE(
      new Request("http://localhost:3101/api/account/delivery-addresses/addr_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "addr_1" }) },
    );
    const deletePayload = (await deleteRes.json()) as { ok?: boolean };

    expect(deleteRes.status).toBe(200);
    expect(deletePayload.ok).toBe(true);
    expect(deleteDeliveryAddressForUserMock).toHaveBeenCalledWith("user_1", "addr_1");
  });

  it("bloque la creation d'une adresse en doublon", async () => {
    createDeliveryAddressForUserMock.mockRejectedValue(new DeliveryAddressDuplicateError("addr_1"));

    const { POST } = await import("@/app/api/account/delivery-addresses/route");
    const req = new Request("http://localhost:3101/api/account/delivery-addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Maison",
        shippingLine1: "123 rue Olive",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G5L 1A1",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(payload.error).toContain("déjà enregistrée");
  });

  it("bloque la creation quand le maximum d'adresses est atteint", async () => {
    createDeliveryAddressForUserMock.mockRejectedValue(new DeliveryAddressLimitError(3));

    const { POST } = await import("@/app/api/account/delivery-addresses/route");
    const req = new Request("http://localhost:3101/api/account/delivery-addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Chalet",
        shippingLine1: "123 rue Olive",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G5L 1A1",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(payload.error).toContain("3");
  });

  it("bloque la creation d'une adresse incomplete", async () => {
    createDeliveryAddressForUserMock.mockRejectedValue(new DeliveryAddressIncompleteError());

    const { POST } = await import("@/app/api/account/delivery-addresses/route");
    const req = new Request("http://localhost:3101/api/account/delivery-addresses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Maison",
        shippingLine1: "123 rue Olive",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G0L1B0",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Adresse incomplete");
  });

  it("bloque la modification vers une adresse deja existante", async () => {
    updateDeliveryAddressForUserMock.mockRejectedValue(new DeliveryAddressDuplicateError("addr_2"));

    const { PATCH } = await import("@/app/api/account/delivery-addresses/[id]/route");
    const patchReq = new Request("http://localhost:3101/api/account/delivery-addresses/addr_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shippingLine1: "123 rue Olive",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G5L 1A1",
        shippingCountry: "CA",
      }),
    });

    const res = await PATCH(patchReq, { params: Promise.resolve({ id: "addr_1" }) });
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(payload.error).toContain("déjà enregistrée");
  });
});
