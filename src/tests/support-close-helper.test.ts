export {};

const {
  supportConversationFindFirstMock,
  txSupportConversationFindUniqueMock,
  txSupportConversationFindUniqueOrThrowMock,
  txSupportConversationUpdateMock,
  txSupportInternalNoteCreateMock,
  txAuditLogCreateMock,
} = vi.hoisted(() => ({
  supportConversationFindFirstMock: vi.fn(),
  txSupportConversationFindUniqueMock: vi.fn(),
  txSupportConversationFindUniqueOrThrowMock: vi.fn(),
  txSupportConversationUpdateMock: vi.fn(),
  txSupportInternalNoteCreateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportConversation: {
      findFirst: (...args: unknown[]) => supportConversationFindFirstMock(...args),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        supportConversation: {
          findUnique: (...args: unknown[]) => txSupportConversationFindUniqueMock(...args),
          findUniqueOrThrow: (...args: unknown[]) => txSupportConversationFindUniqueOrThrowMock(...args),
          update: (...args: unknown[]) => txSupportConversationUpdateMock(...args),
        },
        supportInternalNote: {
          create: (...args: unknown[]) => txSupportInternalNoteCreateMock(...args),
        },
        auditLog: {
          create: (...args: unknown[]) => txAuditLogCreateMock(...args),
        },
      }),
  },
}));

vi.mock("@/lib/email", () => ({
  sendSmsNotification: vi.fn(),
}));

vi.mock("@/lib/app-notifications", () => ({
  createAdminAppNotification: vi.fn(),
  createAppNotification: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

vi.mock("@/lib/support-email", () => ({
  sendConversationAssignedEmail: vi.fn(),
  sendNewConversationEmail: vi.fn(),
  sendNewMessageEmail: vi.fn(),
}));

vi.mock("@/lib/support-notification-preferences", () => ({
  shouldSendConversationAssignedEmail: vi.fn(() => false),
  shouldSendNewConversationEmail: vi.fn(() => false),
  shouldSendNewMessageEmail: vi.fn(() => false),
}));

const customerUser = {
  id: "user_1",
  email: "client@chezolive.ca",
  firstName: "Client",
  lastName: "Olive",
  role: "CUSTOMER",
  language: "fr",
} as const;

const closedConversation = {
  id: "conv_1",
  customerUserId: "user_1",
  customerEmail: "client@chezolive.ca",
  customerName: "Client Olive",
  assignedAdminId: null,
  status: "CLOSED",
  priority: "NORMAL",
  source: "WIDGET",
  tagsJson: null,
  aiSummary: null,
  aiIntent: null,
  closedReason: "RESOLVED",
  closedNote: null,
  reopenedAt: null,
  priorityUpdatedAt: null,
  slaDueAt: null,
  lastMessageAt: new Date("2026-06-20T14:00:00.000Z"),
  createdAt: new Date("2026-06-20T14:00:00.000Z"),
  updatedAt: new Date("2026-06-20T14:10:00.000Z"),
  messages: [],
  internalNotes: [],
  order: null,
  customerUser: null,
  assignedAdmin: null,
};

describe("support conversation close helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    supportConversationFindFirstMock.mockResolvedValue({ id: "conv_1" });
    txSupportConversationFindUniqueMock.mockResolvedValue(closedConversation);
    txSupportConversationFindUniqueOrThrowMock.mockResolvedValue(closedConversation);
  });

  it("retourne un billet deja ferme sans dupliquer les effets de fermeture", async () => {
    const { closeSupportConversationAsCustomer } = await import("@/lib/support");

    const result = await closeSupportConversationAsCustomer("conv_1", customerUser, { reason: "RESOLVED" });

    expect(result).toEqual(expect.objectContaining({ id: "conv_1", status: "CLOSED" }));
    expect(txSupportConversationUpdateMock).not.toHaveBeenCalled();
    expect(txSupportInternalNoteCreateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  it("refuse de fermer un billet qui n'appartient pas au client", async () => {
    supportConversationFindFirstMock.mockResolvedValueOnce(null);
    const { closeSupportConversationAsCustomer } = await import("@/lib/support");

    await expect(closeSupportConversationAsCustomer("conv_other", customerUser)).rejects.toThrow("CONVERSATION_NOT_FOUND");
  });
});
