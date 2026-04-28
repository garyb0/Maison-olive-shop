const requireUserMock = vi.fn();
const getDogProfilesForUserMock = vi.fn();
const claimDogProfileForUserMock = vi.fn();
const updateDogProfileForUserMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/dogs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dogs")>("@/lib/dogs");
  return {
    ...actual,
    getDogProfilesForUser: (...args: unknown[]) => getDogProfilesForUserMock(...args),
    claimDogProfileForUser: (...args: unknown[]) => claimDogProfileForUserMock(...args),
    updateDogProfileForUser: (...args: unknown[]) => updateDogProfileForUserMock(...args),
  };
});

describe("account dog routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user_1" });
  });

  it("claim un QR de chien", async () => {
    claimDogProfileForUserMock.mockResolvedValue({
      id: "dog_1",
      publicToken: "dog-token-001",
      name: "Olive",
      ownerPhone: "418-555-1212",
      publicProfileEnabled: true,
      showPhotoPublic: false,
      showAgePublic: false,
      showPhonePublic: false,
      showNotesPublic: false,
      isActive: true,
    });

    const { POST } = await import("@/app/api/account/dogs/route");
    const request = new Request("http://localhost:3101/api/account/dogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicToken: "dog-token-001",
        name: "Olive",
        ownerPhone: "418-555-1212",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { dog?: { name: string } };

    expect(response.status).toBe(200);
    expect(payload.dog?.name).toBe("Olive");
    expect(claimDogProfileForUserMock).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({
        publicToken: "dog-token-001",
        name: "Olive",
      }),
    );
  });

  it("retourne 409 si le QR est deja reclame", async () => {
    const { DogProfileAlreadyClaimedError } = await import("@/lib/dogs");
    claimDogProfileForUserMock.mockRejectedValue(new DogProfileAlreadyClaimedError());

    const { POST } = await import("@/app/api/account/dogs/route");
    const request = new Request("http://localhost:3101/api/account/dogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicToken: "dog-token-001",
        name: "Olive",
        ownerPhone: "418-555-1212",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Dog QR code already claimed");
  });

  it("met a jour une fiche chien", async () => {
    updateDogProfileForUserMock.mockResolvedValue({
      id: "dog_1",
      name: "Olive Supreme",
      ownerPhone: "418-555-1212",
      publicProfileEnabled: true,
      showPhotoPublic: true,
      showAgePublic: false,
      showPhonePublic: true,
      showNotesPublic: false,
      isActive: false,
    });

    const { PATCH } = await import("@/app/api/account/dogs/[id]/route");
    const request = new Request("http://localhost:3101/api/account/dogs/dog_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Olive Supreme",
        isActive: false,
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "dog_1" }) });
    const payload = (await response.json()) as { dog?: { name: string; isActive: boolean } };

    expect(response.status).toBe(200);
    expect(payload.dog).toEqual(
      expect.objectContaining({
        name: "Olive Supreme",
        isActive: false,
      }),
    );
    expect(updateDogProfileForUserMock).toHaveBeenCalledWith(
      "user_1",
      "dog_1",
      expect.objectContaining({
        name: "Olive Supreme",
        isActive: false,
      }),
    );
  });

  it("retourne 400 si le bouton d'appel public est active sans telephone", async () => {
    const { POST } = await import("@/app/api/account/dogs/route");
    const request = new Request("http://localhost:3101/api/account/dogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicToken: "dog-token-001",
        name: "Olive",
        ownerPhone: "",
        showPhonePublic: true,
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid dog claim payload");
    expect(claimDogProfileForUserMock).not.toHaveBeenCalled();
  });

  it("retourne 400 sur la modification si le numéro public est activé sans téléphone", async () => {
    const { DogProfilePublicPhoneRequiredError } = await import("@/lib/dogs");
    updateDogProfileForUserMock.mockRejectedValue(new DogProfilePublicPhoneRequiredError());

    const { PATCH } = await import("@/app/api/account/dogs/[id]/route");
    const request = new Request("http://localhost:3101/api/account/dogs/dog_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        showPhonePublic: true,
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "dog_1" }) });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("A phone number is required to enable the call button.");
  });

  it("retourne 401 si non authentifie", async () => {
    requireUserMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const { GET } = await import("@/app/api/account/dogs/route");
    const response = await GET();
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(getDogProfilesForUserMock).not.toHaveBeenCalled();
  });
});
