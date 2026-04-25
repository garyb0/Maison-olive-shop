export {};

const queryRawMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("health route", () => {
  const previousAppRelease = process.env.APP_RELEASE;
  const previousVercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousGitSha = process.env.GIT_COMMIT_SHA;
  const previousGitHead = process.env.npm_package_gitHead;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    queryRawMock.mockResolvedValue([{ ok: 1 }]);

    delete process.env.APP_RELEASE;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.npm_package_gitHead;
  });

  afterAll(() => {
    if (previousAppRelease === undefined) delete process.env.APP_RELEASE;
    else process.env.APP_RELEASE = previousAppRelease;

    if (previousVercelSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousVercelSha;

    if (previousGitSha === undefined) delete process.env.GIT_COMMIT_SHA;
    else process.env.GIT_COMMIT_SHA = previousGitSha;

    if (previousGitHead === undefined) delete process.env.npm_package_gitHead;
    else process.env.npm_package_gitHead = previousGitHead;
  });

  it("expose une release non vide en fallback", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const payload = (await response.json()) as { release?: string; ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(typeof payload.release).toBe("string");
    expect(payload.release).not.toBe("");
    expect(payload.release).not.toBe("unknown");
  });

  it("priorise APP_RELEASE quand defini", async () => {
    process.env.APP_RELEASE = "manual-release-42";

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const payload = (await response.json()) as { release?: string };

    expect(response.status).toBe(200);
    expect(payload.release).toBe("manual-release-42");
  });
});
