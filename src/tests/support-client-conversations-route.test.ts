export {};

const {
  getCurrentUserMock,
  createSupportConversationMock,
  createSupportGuestAccessTokenMock,
  getCustomerSupportInboxMock,
  getSupportConversationForCustomerMock,
  getSupportConversationPublicMock,
  closeSupportConversationAsCustomerMock,
  closeSupportConversationAsGuestMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  createSupportConversationMock: vi.fn(),
  createSupportGuestAccessTokenMock: vi.fn(),
  getCustomerSupportInboxMock: vi.fn(),
  getSupportConversationForCustomerMock: vi.fn(),
  getSupportConversationPublicMock: vi.fn(),
  closeSupportConversationAsCustomerMock: vi.fn(),
  closeSupportConversationAsGuestMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: () => ({ ok: true }),
}));

vi.mock("@/lib/support", () => ({
  closeSupportConversationAsCustomer: (...args: unknown[]) => closeSupportConversationAsCustomerMock(...args),
  closeSupportConversationAsGuest: (...args: unknown[]) => closeSupportConversationAsGuestMock(...args),
  createSupportConversation: (...args: unknown[]) => createSupportConversationMock(...args),
  createSupportGuestAccessToken: (...args: unknown[]) => createSupportGuestAccessTokenMock(...args),
  getCustomerSupportInbox: (...args: unknown[]) => getCustomerSupportInboxMock(...args),
  getSupportConversationForCustomer: (...args: unknown[]) => getSupportConversationForCustomerMock(...args),
  getSupportConversationPublic: (...args: unknown[]) => getSupportConversationPublicMock(...args),
}));

const customerUser = {
  id: "user_1",
  email: "client@chezolive.ca",
  firstName: "Client",
  lastName: "Olive",
  role: "CUSTOMER",
};

const adminUser = {
  id: "admin_1",
  email: "admin@chezolive.ca",
  firstName: "Admin",
  lastName: "Olive",
  role: "ADMIN",
};

const customerConversation = {
  id: "conv_1",
  status: "ASSIGNED",
  customerEmail: "client@chezolive.ca",
  customerName: "Client Olive",
  unreadCount: 1,
  lastMessagePreview: "Bonjour, je regarde ça.",
  messages: [
    {
      id: "msg_customer",
      senderType: "CUSTOMER",
      content: "Bonjour, j'ai besoin d'aide.",
      createdAt: "2026-06-20T14:00:00.000Z",
    },
    {
      id: "msg_admin",
      senderType: "ADMIN",
      content: "Bonjour, je regarde ça.",
      createdAt: "2026-06-20T14:03:00.000Z",
    },
  ],
};

function routeContext(id = "conv_1") {
  return { params: Promise.resolve({ id }) };
}

describe("support client conversations routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue(customerUser);
    getCustomerSupportInboxMock.mockResolvedValue({
      adminAvailable: true,
      activeConversation: customerConversation,
      conversations: [customerConversation],
    });
    getSupportConversationForCustomerMock.mockResolvedValue(customerConversation);
    getSupportConversationPublicMock.mockResolvedValue(customerConversation);
    closeSupportConversationAsCustomerMock.mockResolvedValue({ ...customerConversation, status: "CLOSED" });
    closeSupportConversationAsGuestMock.mockResolvedValue({ ...customerConversation, status: "CLOSED" });
    createSupportConversationMock.mockResolvedValue(customerConversation);
    createSupportGuestAccessTokenMock.mockReturnValue("guest_token");
  });

  it("liste les conversations client avec les messages admin visibles", async () => {
    const { GET } = await import("@/app/api/support/conversations/route");

    const response = await GET();
    const payload = (await response.json()) as { conversations?: typeof customerConversation[] };

    expect(response.status).toBe(200);
    expect(payload.conversations?.[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          senderType: "ADMIN",
          content: "Bonjour, je regarde ça.",
        }),
      ]),
    );
    expect(getCustomerSupportInboxMock).toHaveBeenCalledWith(customerUser);
  });

  it("refuse la liste support sans client connecte", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/support/conversations/route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getCustomerSupportInboxMock).not.toHaveBeenCalled();
  });

  it("refuse la liste support aux admins", async () => {
    getCurrentUserMock.mockResolvedValueOnce(adminUser);
    const { GET } = await import("@/app/api/support/conversations/route");

    const response = await GET();

    expect(response.status).toBe(403);
    expect(getCustomerSupportInboxMock).not.toHaveBeenCalled();
  });

  it("permet au client proprietaire de charger une conversation precise", async () => {
    const { GET } = await import("@/app/api/support/conversations/[id]/route");

    const response = await GET(new Request("http://localhost:3101/api/support/conversations/conv_1"), routeContext());
    const payload = (await response.json()) as { conversation?: typeof customerConversation };

    expect(response.status).toBe(200);
    expect(payload.conversation?.messages[1]).toEqual(
      expect.objectContaining({ senderType: "ADMIN", content: "Bonjour, je regarde ça." }),
    );
    expect(getSupportConversationForCustomerMock).toHaveBeenCalledWith("conv_1", customerUser);
    expect(getSupportConversationPublicMock).not.toHaveBeenCalled();
  });

  it("ne permet pas a un client de lire une conversation qui ne lui appartient pas", async () => {
    getSupportConversationForCustomerMock.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/support/conversations/[id]/route");

    const response = await GET(new Request("http://localhost:3101/api/support/conversations/conv_other"), routeContext("conv_other"));

    expect(response.status).toBe(404);
  });

  it("permet au client proprietaire de fermer son billet", async () => {
    const { POST } = await import("@/app/api/support/conversations/[id]/close/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "RESOLVED" }),
    });

    const response = await POST(request, routeContext());
    const payload = (await response.json()) as { conversation?: typeof customerConversation };

    expect(response.status).toBe(200);
    expect(payload.conversation?.status).toBe("CLOSED");
    expect(closeSupportConversationAsCustomerMock).toHaveBeenCalledWith("conv_1", customerUser, { reason: "RESOLVED" });
  });

  it("ne permet pas a un client de fermer une conversation qui ne lui appartient pas", async () => {
    closeSupportConversationAsCustomerMock.mockRejectedValueOnce(new Error("CONVERSATION_NOT_FOUND"));
    const { POST } = await import("@/app/api/support/conversations/[id]/close/route");

    const response = await POST(
      new Request("http://localhost:3101/api/support/conversations/conv_other/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "RESOLVED" }),
      }),
      routeContext("conv_other"),
    );

    expect(response.status).toBe(404);
  });

  it("permet a un invite de fermer son billet avec un token valide", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/support/conversations/[id]/close/route");

    const response = await POST(
      new Request("http://localhost:3101/api/support/conversations/conv_1/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail: "client@chezolive.ca", guestToken: "guest_token", reason: "RESOLVED" }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(closeSupportConversationAsGuestMock).toHaveBeenCalledWith("conv_1", "client@chezolive.ca", "guest_token", {
      guestEmail: "client@chezolive.ca",
      guestToken: "guest_token",
      reason: "RESOLVED",
    });
  });

  it("refuse a un invite de fermer sans token valide", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    closeSupportConversationAsGuestMock.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const { POST } = await import("@/app/api/support/conversations/[id]/close/route");

    const response = await POST(
      new Request("http://localhost:3101/api/support/conversations/conv_1/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail: "client@chezolive.ca", guestToken: "bad_token" }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(403);
  });
});
