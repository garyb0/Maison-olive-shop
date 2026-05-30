const statMock = vi.fn();
const readFileMock = vi.fn();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mockedPromises = {
    ...actual.promises,
    stat: (...args: unknown[]) => statMock(...args),
    readFile: (...args: unknown[]) => readFileMock(...args),
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

describe("public logo image route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    statMock.mockResolvedValue({
      isFile: () => true,
      size: 4,
    });
    readFileMock.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("sert dynamiquement une image uploadée dans public/Logo", async () => {
    const { GET } = await import("@/app/Logo/[filename]/route");

    const response = await GET({} as Request, {
      params: Promise.resolve({ filename: "fresh-product.png" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it("rejette les noms de fichiers non sécuritaires", async () => {
    const { GET } = await import("@/app/Logo/[filename]/route");

    const response = await GET({} as Request, {
      params: Promise.resolve({ filename: "../secret.png" }),
    });

    expect(response.status).toBe(404);
    expect(statMock).not.toHaveBeenCalled();
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
