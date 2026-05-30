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
  const previousHealthcheckDetailToken = process.env.HEALTHCHECK_DETAIL_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    queryRawMock.mockResolvedValue([{ ok: 1 }]);

    delete process.env.APP_RELEASE;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
    delete process.env.npm_package_gitHead;
    delete process.env.HEALTHCHECK_DETAIL_TOKEN;
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

    if (previousHealthcheckDetailToken === undefined) delete process.env.HEALTHCHECK_DETAIL_TOKEN;
    else process.env.HEALTHCHECK_DETAIL_TOKEN = previousHealthcheckDetailToken;
  });

  it("expose seulement l'etat minimal publiquement", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(new Request("https://chezolive.ca/api/health"));
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(payload).not.toHaveProperty("release");
    expect(payload).not.toHaveProperty("version");
    expect(payload).not.toHaveProperty("service");
    expect(payload).not.toHaveProperty("checks");
  });

  it("expose une release non vide en fallback avec le bearer interne", async () => {
    process.env.HEALTHCHECK_DETAIL_TOKEN = "health-detail-token";

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(
      new Request("https://chezolive.ca/api/health", {
        headers: { authorization: "Bearer health-detail-token" },
      }),
    );
    const payload = (await response.json()) as { release?: string; ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(typeof payload.release).toBe("string");
    expect(payload.release).not.toBe("");
    expect(payload.release).not.toBe("unknown");
  });

  it("priorise APP_RELEASE quand defini avec le bearer interne", async () => {
    process.env.APP_RELEASE = "manual-release-42";
    process.env.HEALTHCHECK_DETAIL_TOKEN = "health-detail-token";

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(
      new Request("https://chezolive.ca/api/health", {
        headers: { authorization: "Bearer health-detail-token" },
      }),
    );
    const payload = (await response.json()) as { release?: string };

    expect(response.status).toBe(200);
    expect(payload.release).toBe("manual-release-42");
  });
});
