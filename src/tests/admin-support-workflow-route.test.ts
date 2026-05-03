export {};

const {
  requireAdminMock,
  addSupportInternalNoteMock,
  createSupportQuickReplyMock,
  listSupportQuickRepliesMock,
  reopenSupportConversationMock,
  unassignSupportConversationMock,
  updateSupportConversationAsAdminMock,
  updateSupportQuickReplyMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  addSupportInternalNoteMock: vi.fn(),
  createSupportQuickReplyMock: vi.fn(),
  listSupportQuickRepliesMock: vi.fn(),
  reopenSupportConversationMock: vi.fn(),
  unassignSupportConversationMock: vi.fn(),
  updateSupportConversationAsAdminMock: vi.fn(),
  updateSupportQuickReplyMock: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/support", () => ({
  addSupportInternalNote: (...args: unknown[]) => addSupportInternalNoteMock(...args),
  createSupportQuickReply: (...args: unknown[]) => createSupportQuickReplyMock(...args),
  listSupportQuickReplies: (...args: unknown[]) => listSupportQuickRepliesMock(...args),
  reopenSupportConversation: (...args: unknown[]) => reopenSupportConversationMock(...args),
  unassignSupportConversation: (...args: unknown[]) => unassignSupportConversationMock(...args),
  updateSupportConversationAsAdmin: (...args: unknown[]) => updateSupportConversationAsAdminMock(...args),
  updateSupportQuickReply: (...args: unknown[]) => updateSupportQuickReplyMock(...args),
}));

const admin = {
  id: "admin_1",
  email: "admin@chezolive.ca",
  firstName: "Admin",
  lastName: "Olive",
  role: "ADMIN",
};

const conversation = {
  id: "conv_1",
  status: "OPEN",
};

const quickReply = {
  id: "qr_1",
  title: "Accueil",
  content: "Bonjour, je regarde ça.",
  category: "general",
  language: "fr",
  isActive: true,
  sortOrder: 1,
};

function routeContext(id = "conv_1") {
  return { params: Promise.resolve({ id }) };
}

describe("admin support workflow routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue(admin);
    addSupportInternalNoteMock.mockResolvedValue(conversation);
    createSupportQuickReplyMock.mockResolvedValue(quickReply);
    listSupportQuickRepliesMock.mockResolvedValue([quickReply]);
    reopenSupportConversationMock.mockResolvedValue(conversation);
    unassignSupportConversationMock.mockResolvedValue(conversation);
    updateSupportConversationAsAdminMock.mockResolvedValue(conversation);
    updateSupportQuickReplyMock.mockResolvedValue(quickReply);
  });

  it("met a jour priorite et tags d'une conversation", async () => {
    const { PATCH } = await import("@/app/api/admin/support/conversations/[id]/route");
    const request = new Request("http://localhost:3101/api/admin/support/conversations/conv_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "HIGH", tags: ["livraison", "urgent"] }),
    });

    const response = await PATCH(request, routeContext());

    expect(response.status).toBe(200);
    expect(updateSupportConversationAsAdminMock).toHaveBeenCalledWith("conv_1", admin, {
      priority: "HIGH",
      tags: ["livraison", "urgent"],
    });
  });

  it("ajoute une note interne admin", async () => {
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/notes/route");
    const request = new Request("http://localhost:3101/api/admin/support/conversations/conv_1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Client à rappeler." }),
    });

    const response = await POST(request, routeContext());

    expect(response.status).toBe(200);
    expect(addSupportInternalNoteMock).toHaveBeenCalledWith("conv_1", admin, "Client à rappeler.");
  });

  it("reouvre et libere une conversation", async () => {
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/reopen/route");
    const { DELETE } = await import("@/app/api/admin/support/conversations/[id]/assign/route");

    const reopenResponse = await POST(new Request("http://localhost:3101/api/admin/support/conversations/conv_1/reopen"), routeContext());
    const unassignResponse = await DELETE(new Request("http://localhost:3101/api/admin/support/conversations/conv_1/assign"), routeContext());

    expect(reopenResponse.status).toBe(200);
    expect(unassignResponse.status).toBe(200);
    expect(reopenSupportConversationMock).toHaveBeenCalledWith("conv_1", admin);
    expect(unassignSupportConversationMock).toHaveBeenCalledWith("conv_1", admin);
  });

  it("liste et cree des macros serveur", async () => {
    const { GET, POST } = await import("@/app/api/admin/support/quick-replies/route");
    const listResponse = await GET(new Request("http://localhost:3101/api/admin/support/quick-replies?language=fr"));
    const createResponse = await POST(
      new Request("http://localhost:3101/api/admin/support/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Accueil", content: "Bonjour", category: "general", language: "fr" }),
      }),
    );

    expect(listResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);
    expect(listSupportQuickRepliesMock).toHaveBeenCalledWith("fr");
    expect(createSupportQuickReplyMock).toHaveBeenCalledWith(admin, {
      title: "Accueil",
      content: "Bonjour",
      category: "general",
      language: "fr",
    });
  });

  it("desactive une macro au lieu de la supprimer physiquement", async () => {
    const { DELETE } = await import("@/app/api/admin/support/quick-replies/[id]/route");

    const response = await DELETE(new Request("http://localhost:3101/api/admin/support/quick-replies/qr_1"), routeContext("qr_1"));

    expect(response.status).toBe(200);
    expect(updateSupportQuickReplyMock).toHaveBeenCalledWith("qr_1", admin, { isActive: false });
  });
});
