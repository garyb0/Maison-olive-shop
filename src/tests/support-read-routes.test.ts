export {};

const {
  applyRateLimitMock,
  getCurrentUserMock,
  requireAdminMock,
  markSupportConversationReadAsAdminMock,
  markSupportConversationReadAsCustomerMock,
  markSupportConversationReadAsGuestMock,
} = vi.hoisted(() => ({
  applyRateLimitMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  requireAdminMock: vi.fn(),
  markSupportConversationReadAsAdminMock: vi.fn(),
  markSupportConversationReadAsCustomerMock: vi.fn(),
  markSupportConversationReadAsGuestMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/support", () => ({
  markSupportConversationReadAsAdmin: (...args: unknown[]) => markSupportConversationReadAsAdminMock(...args),
  markSupportConversationReadAsCustomer: (...args: unknown[]) => markSupportConversationReadAsCustomerMock(...args),
  markSupportConversationReadAsGuest: (...args: unknown[]) => markSupportConversationReadAsGuestMock(...args),
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

const conversation = {
  id: "conv_1",
  unreadCount: 0,
  messages: [],
};

function routeContext(id = "conv_1") {
  return { params: Promise.resolve({ id }) };
}

describe("support read routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true });
    getCurrentUserMock.mockResolvedValue(null);
    requireAdminMock.mockResolvedValue(adminUser);
    markSupportConversationReadAsAdminMock.mockResolvedValue(conversation);
    markSupportConversationReadAsCustomerMock.mockResolvedValue(conversation);
    markSupportConversationReadAsGuestMock.mockResolvedValue(conversation);
  });

  it("marque une conversation invitee comme lue avec token", async () => {
    const { POST } = await import("@/app/api/support/conversations/[id]/read/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestEmail: "guest@example.com", guestToken: "token_123" }),
    });

    const response = await POST(request, routeContext());
    const payload = (await response.json()) as { conversation?: typeof conversation };

    expect(response.status).toBe(200);
    expect(payload.conversation).toEqual(conversation);
    expect(markSupportConversationReadAsGuestMock).toHaveBeenCalledWith("conv_1", "guest@example.com", "token_123");
  });

  it("marque une conversation client connecte comme lue", async () => {
    getCurrentUserMock.mockResolvedValueOnce(customerUser);
    const { POST } = await import("@/app/api/support/conversations/[id]/read/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/read", {
      method: "POST",
    });

    const response = await POST(request, routeContext());

    expect(response.status).toBe(200);
    expect(markSupportConversationReadAsCustomerMock).toHaveBeenCalledWith("conv_1", customerUser);
    expect(markSupportConversationReadAsGuestMock).not.toHaveBeenCalled();
  });

  it("refuse la route client aux admins", async () => {
    getCurrentUserMock.mockResolvedValueOnce(adminUser);
    const { POST } = await import("@/app/api/support/conversations/[id]/read/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/read", {
      method: "POST",
    });

    const response = await POST(request, routeContext());
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
  });

  it("refuse un token invite invalide", async () => {
    markSupportConversationReadAsGuestMock.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const { POST } = await import("@/app/api/support/conversations/[id]/read/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestEmail: "guest@example.com", guestToken: "bad_token" }),
    });

    const response = await POST(request, routeContext());

    expect(response.status).toBe(403);
  });

  it("respecte le rate limit du marquage lu client", async () => {
    applyRateLimitMock.mockResolvedValueOnce({ ok: false });
    const { POST } = await import("@/app/api/support/conversations/[id]/read/route");
    const request = new Request("http://localhost:3101/api/support/conversations/conv_1/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestEmail: "guest@example.com", guestToken: "token_123" }),
    });

    const response = await POST(request, routeContext());

    expect(response.status).toBe(429);
    expect(markSupportConversationReadAsGuestMock).not.toHaveBeenCalled();
  });

  it("marque une conversation comme lue cote admin", async () => {
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/read/route");

    const response = await POST(new Request("http://localhost:3101/api/admin/support/conversations/conv_1/read"), routeContext());
    const payload = (await response.json()) as { conversation?: typeof conversation };

    expect(response.status).toBe(200);
    expect(payload.conversation).toEqual(conversation);
    expect(markSupportConversationReadAsAdminMock).toHaveBeenCalledWith("conv_1", adminUser);
  });

  it("protege le marquage lu admin", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const { POST } = await import("@/app/api/admin/support/conversations/[id]/read/route");

    const response = await POST(new Request("http://localhost:3101/api/admin/support/conversations/conv_1/read"), routeContext());

    expect(response.status).toBe(401);
    expect(markSupportConversationReadAsAdminMock).not.toHaveBeenCalled();
  });
});
