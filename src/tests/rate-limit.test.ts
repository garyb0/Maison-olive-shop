export {};

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const updateMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitBucket: {
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        rateLimitBucket: {
          findUnique: (...args: unknown[]) => findUniqueMock(...args),
          upsert: (...args: unknown[]) => upsertMock(...args),
          update: (...args: unknown[]) => updateMock(...args),
        },
      }),
  },
}));

describe("rate-limit identity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("ignore les headers proxy generiques quand APP_TRUST_PROXY=none", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { appTrustProxy: "none" },
    }));

    const { getRateLimitIdentity } = await import("@/lib/rate-limit");
    const request = new Request("https://chezolive.ca/api/orders", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "5.6.7.8",
        "cf-connecting-ip": "9.9.9.9",
      },
    });

    expect(getRateLimitIdentity(request)).toBe("direct");
  });

  it("utilise seulement CF-Connecting-IP quand APP_TRUST_PROXY=cloudflare", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { appTrustProxy: "cloudflare" },
    }));

    const { getRateLimitIdentity } = await import("@/lib/rate-limit");
    const request = new Request("https://chezolive.ca/api/orders", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "5.6.7.8",
        "cf-connecting-ip": "203.0.113.10",
      },
    });

    expect(getRateLimitIdentity(request)).toBe("cf:203.0.113.10");
  });

  it("bucketise une identite explicite sans lire les headers", async () => {
    vi.doMock("@/lib/env", () => ({
      env: { appTrustProxy: "none" },
    }));
    findUniqueMock.mockResolvedValue(null);

    const { applyRateLimit } = await import("@/lib/rate-limit");
    const result = await applyRateLimit(new Request("https://chezolive.ca/api/driver/run/t/location"), {
      namespace: "driver:location",
      windowMs: 60_000,
      max: 120,
      identity: "driver-token:abc123",
    });

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "driver:location:driver-token:abc123" },
      }),
    );
  });
});
