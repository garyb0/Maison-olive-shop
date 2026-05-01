import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";

const conversation = {
  id: "conv_ai",
  customerEmail: "client@example.com",
  customerName: "Client IA",
  status: "OPEN",
  priority: "NORMAL",
  tags: [],
  aiEnabled: true,
  unreadCount: 0,
  lastMessageAt: "2026-04-29T14:00:00.000Z",
  customerContext: {
    account: null,
    linkedOrder: null,
    recentOrders: [],
    supportHistoryCount: 1,
  },
  messages: [
    {
      id: "msg_1",
      senderType: "CUSTOMER",
      content: "Bonjour, j'aimerais savoir quand ma livraison arrive.",
      createdAt: "2026-04-29T14:00:00.000Z",
    },
  ],
};

const suggestion = {
  summary: "Le client demande une precision sur la livraison.",
  intent: "Question livraison",
  priority: "NORMAL",
  tags: ["livraison"],
  draftReply: "Bonjour, je verifie votre livraison et je vous reviens avec une reponse claire.",
  confidence: 0.86,
  needsHumanReview: ["Verifier le statut de livraison avant l'envoi."],
  generatedAt: "2026-04-29T14:01:00.000Z",
  model: "gpt-5-mini",
  provider: "openai",
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("AdminSupportPanel AI suggestion", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/admin/support/settings")) {
          return jsonResponse({ uiSettings: { displayName: "Sophie" }, supportHealth: { ok: true } });
        }
        if (url.includes("/api/admin/support/quick-replies")) {
          return jsonResponse({ quickReplies: [] });
        }
        if (url.endsWith("/api/admin/support/conversations")) {
          return jsonResponse({ conversations: [conversation] });
        }
        if (url.endsWith("/api/admin/support/conversations/conv_ai/ai-suggestion")) {
          return jsonResponse({ suggestion });
        }
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("genere une suggestion et insere le brouillon manuellement", async () => {
    render(<AdminSupportPanel language="fr" />);

    expect(await screen.findByText("Client IA")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Générer une suggestion IA" }));

    expect(await screen.findByText("Brouillon proposé")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Insérer le brouillon" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Écrire une réponse…")).toHaveValue(suggestion.draftReply);
    });
  });
});
