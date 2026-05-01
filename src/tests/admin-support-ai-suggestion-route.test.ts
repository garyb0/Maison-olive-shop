export {};

const { requireAdminMock, generateSupportAiSuggestionMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  generateSupportAiSuggestionMock: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/support-ai", () => ({
  generateSupportAiSuggestion: (...args: unknown[]) => generateSupportAiSuggestionMock(...args),
  getSupportAiAvailability: () => ({
    enabled: true,
    configured: true,
    provider: "openai",
    model: "gpt-5-mini",
  }),
}));

const admin = {
  id: "admin_1",
  email: "admin@chezolive.ca",
  firstName: "Admin",
  lastName: "Olive",
  role: "ADMIN",
  language: "fr",
};

const suggestion = {
  summary: "Le client demande une precision sur la livraison.",
  intent: "livraison",
  priority: "NORMAL",
  tags: ["livraison"],
  draftReply: "Bonjour, je verifie les details de livraison pour vous.",
  confidence: 0.82,
  needsHumanReview: ["Verifier le statut de commande."],
  generatedAt: "2026-04-29T14:00:00.000Z",
  model: "gpt-5-mini",
  provider: "openai",
};

function routeContext(id = "conv_1") {
  return { params: Promise.resolve({ id }) };
}

describe("admin support AI suggestion route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(admin);
    generateSupportAiSuggestionMock.mockResolvedValue(suggestion);
  });

  it("genere une suggestion IA seulement apres authentification admin", async () => {
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/ai-suggestion/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/support/conversations/conv_1/ai-suggestion", {
        method: "POST",
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suggestion).toMatchObject({ draftReply: suggestion.draftReply, provider: "openai" });
    expect(generateSupportAiSuggestionMock).toHaveBeenCalledWith("conv_1", admin);
  });

  it("bloque les visiteurs non connectes", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/ai-suggestion/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/support/conversations/conv_1/ai-suggestion", {
        method: "POST",
      }),
      routeContext(),
    );

    expect(response.status).toBe(401);
    expect(generateSupportAiSuggestionMock).not.toHaveBeenCalled();
  });

  it("retourne un etat clair quand l'IA est desactivee", async () => {
    generateSupportAiSuggestionMock.mockRejectedValueOnce(new Error("SUPPORT_AI_DISABLED"));
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/ai-suggestion/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/support/conversations/conv_1/ai-suggestion", {
        method: "POST",
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Support AI disabled");
  });
});
