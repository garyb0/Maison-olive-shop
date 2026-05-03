import { createPrivacySafeSupportAiInput, redactSensitiveSupportText } from "@/lib/support-ai";

describe("support AI privacy context", () => {
  it("redacte les donnees personnelles courantes avant l'appel IA", () => {
    const redacted = redactSensitiveSupportText(
      "Client test@example.com, 418-555-1234, G5L 1A1, 4242 4242 4242 4242, 123 rue Saint-Germain.",
    );

    expect(redacted).toContain("[email masque]");
    expect(redacted).toContain("[telephone masque]");
    expect(redacted).toContain("[code postal masque]");
    expect(redacted).toContain("[numero sensible masque]");
    expect(redacted).toContain("[adresse masquee]");
    expect(redacted).not.toContain("test@example.com");
    expect(redacted).not.toContain("418-555-1234");
  });

  it("construit un contexte IA minimal sans courriel ni telephone client", () => {
    const rawContext = {
      enabled: true,
      mode: "admin_suggestion_only",
      guardrail: "review only",
      conversation: {
        id: "conv_1",
        status: "OPEN",
        priority: "NORMAL",
        source: "WIDGET",
        tags: ["livraison"],
        aiSummary: null,
        aiIntent: null,
        lastMessageAt: new Date("2026-04-29T14:00:00.000Z"),
      },
      customer: {
        name: "Client Test",
        email: "client@example.com",
        context: {
          account: {
            id: "user_1",
            email: "client@example.com",
            name: "Client Test",
            role: "CUSTOMER",
          },
          linkedOrder: {
            id: "order_1",
            orderNumber: "MO-1001",
            status: "PROCESSING",
            paymentStatus: "PAID",
            deliveryStatus: "SCHEDULED",
            totalCents: 4299,
            currency: "CAD",
            createdAt: new Date("2026-04-28T14:00:00.000Z"),
          },
          recentOrders: [],
          supportHistoryCount: 2,
        },
      },
      messages: [
        {
          senderType: "CUSTOMER",
          content: "Bonjour, mon telephone est 418-555-1234 et mon email est client@example.com.",
          createdAt: new Date("2026-04-29T14:00:00.000Z"),
        },
      ],
    } as Parameters<typeof createPrivacySafeSupportAiInput>[0];

    const input = createPrivacySafeSupportAiInput(rawContext);
    const serialized = JSON.stringify(input);

    expect(input.customer.accountType).toBe("connected");
    expect(input.customer.linkedOrder?.orderNumber).toBe("MO-1001");
    expect(input.messages[0]?.content).toContain("[telephone masque]");
    expect(serialized).not.toContain("client@example.com");
    expect(serialized).not.toContain("418-555-1234");
    expect(serialized).not.toContain("Client Test");
  });
});
