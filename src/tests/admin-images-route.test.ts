export {};

const requireAdminMock = vi.fn();
const accessMock = vi.fn();
const readdirMock = vi.fn();
const mkdirMock = vi.fn();
const writeFileMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const mockedPromises = {
    ...actual.promises,
    access: (...args: unknown[]) => accessMock(...args),
    readdir: (...args: unknown[]) => readdirMock(...args),
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    writeFile: (...args: unknown[]) => writeFileMock(...args),
  };
  const mockedFs = {
    ...actual,
    promises: mockedPromises,
  };
  return {
    ...mockedFs,
    default: mockedFs,
    promises: mockedPromises,
  };
});

describe("admin images route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    accessMock.mockRejectedValue(new Error("ENOENT"));
    readdirMock.mockResolvedValue([]);
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
  });

  it("rejette les SVG a l'upload", async () => {
    const { POST } = await import("@/app/api/admin/images/route");
    const formData = new FormData();
    formData.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "logo.svg", { type: "image/svg+xml" }),
    );

    const request = {
      formData: async () => formData,
    } as unknown as Request;

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("PNG");
    expect(payload.error).not.toContain("SVG");
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("normalise l'extension selon le MIME type", async () => {
    const { POST } = await import("@/app/api/admin/images/route");
    const formData = new FormData();
    formData.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "promo.php", { type: "image/png" }),
    );

    const request = {
      formData: async () => formData,
    } as unknown as Request;

    const response = await POST(request);
    const payload = (await response.json()) as { image?: { name?: string } };

    expect(response.status).toBe(400);
    expect(payload.image).toBeUndefined();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("ignore les SVG dans la liste admin", async () => {
    accessMock.mockResolvedValue(undefined);
    readdirMock.mockResolvedValue(["olive.svg", "olive.png", "olive.webp"]);

    const { GET } = await import("@/app/api/admin/images/route");
    const response = await GET();
    const payload = (await response.json()) as { images?: Array<{ name: string }> };

    expect(response.status).toBe(200);
    expect(payload.images?.map((image) => image.name)).toEqual(["olive.png", "olive.webp"]);
  });
});
