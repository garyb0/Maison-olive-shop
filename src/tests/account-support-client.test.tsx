import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountSupportClient } from "@/app/account/support/account-support-client";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    createElement("img", { alt, src, ...props }),
}));

const baseConversation = {
  id: "conv_1",
  status: "ASSIGNED",
  customerEmail: "client@chezolive.ca",
  customerName: "Client Olive",
  unreadCount: 1,
  lastMessageAt: "2026-06-20T14:03:00.000Z",
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AccountSupportClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche les reponses admin dans la messagerie mobile", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/support/conversations" && !init?.method) {
        return jsonResponse({
          adminAvailable: true,
          activeConversation: baseConversation,
          conversations: [baseConversation],
        });
      }
      if (url === "/api/support/conversations/conv_1/read") {
        return jsonResponse({ conversation: { ...baseConversation, unreadCount: 0 } });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<AccountSupportClient language="fr" supportEmail="support@chezolive.ca" />);

    expect((await screen.findAllByText("Bonjour, je regarde ça.")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Équipe Chez Olive")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Écris ton message")).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/chez-olive/olive-head.png"]')).not.toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/support/conversations/conv_1/read", { method: "POST" }));
  });

  it("envoie un message client et met a jour le fil", async () => {
    const updatedConversation = {
      ...baseConversation,
      unreadCount: 0,
      messages: [
        ...baseConversation.messages,
        {
          id: "msg_customer_2",
          senderType: "CUSTOMER",
          content: "Merci pour la réponse.",
          createdAt: "2026-06-20T14:05:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/support/conversations" && !init?.method) {
        return jsonResponse({
          adminAvailable: true,
          activeConversation: baseConversation,
          conversations: [baseConversation],
        });
      }
      if (url === "/api/support/conversations/conv_1/read") {
        return jsonResponse({ conversation: { ...baseConversation, unreadCount: 0 } });
      }
      if (url === "/api/support/conversations/conv_1/messages") {
        return jsonResponse({ conversation: updatedConversation });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSupportClient language="fr" supportEmail="support@chezolive.ca" />);

    const textarea = await screen.findByPlaceholderText("Écris ton message");
    fireEvent.change(textarea, { target: { value: "Merci pour la réponse." } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByText("Merci pour la réponse.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support/conversations/conv_1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Merci pour la réponse." }),
      }),
    );
  });

  it("explique clairement quand le billet attend encore une reponse admin", async () => {
    const waitingConversation = {
      ...baseConversation,
      status: "OPEN",
      unreadCount: 0,
      lastMessagePreview: "Est-ce que quelqu'un peut me répondre ?",
      messages: [
        {
          id: "msg_customer_waiting",
          senderType: "CUSTOMER",
          content: "Est-ce que quelqu'un peut me répondre ?",
          createdAt: "2026-06-20T14:08:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/support/conversations") {
        return jsonResponse({
          adminAvailable: true,
          activeConversation: waitingConversation,
          conversations: [waitingConversation],
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSupportClient language="fr" supportEmail="support@chezolive.ca" />);

    expect(await screen.findByText("Ton message est bien ici")).toBeInTheDocument();
    expect(screen.getByText(/L'équipe n'a pas encore répondu/)).toBeInTheDocument();
    expect(screen.getAllByText("Est-ce que quelqu'un peut me répondre ?").length).toBeGreaterThanOrEqual(1);
  });

  it("ferme le billet client avec confirmation", async () => {
    const closedConversation = {
      ...baseConversation,
      status: "CLOSED",
      unreadCount: 0,
      closedAt: "2026-06-20T14:10:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/support/conversations" && !init?.method) {
        return jsonResponse({
          adminAvailable: true,
          activeConversation: baseConversation,
          conversations: [baseConversation],
        });
      }
      if (url === "/api/support/conversations/conv_1/read") {
        return jsonResponse({ conversation: { ...baseConversation, unreadCount: 0 } });
      }
      if (url === "/api/support/conversations/conv_1/close") {
        return jsonResponse({ conversation: closedConversation });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSupportClient language="fr" supportEmail="support@chezolive.ca" />);

    fireEvent.click(await screen.findByRole("button", { name: "Fermer le billet" }));
    expect(await screen.findByText("Fermer ce billet ?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Oui, fermer" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/support/conversations/conv_1/close",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "RESOLVED" }),
        }),
      ),
    );
    expect(await screen.findByText("Conversation terminée")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fermer le billet" })).not.toBeInTheDocument();
  });

  it("garde une conversation fermee en lecture seule", async () => {
    const closedConversation = {
      ...baseConversation,
      status: "CLOSED",
      unreadCount: 0,
      closedAt: "2026-06-20T14:10:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/support/conversations") {
        return jsonResponse({
          adminAvailable: false,
          activeConversation: null,
          conversations: [closedConversation],
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountSupportClient language="fr" supportEmail="support@chezolive.ca" />);

    expect(await screen.findByText("Conversation terminée")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Écris ton message")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fermer le billet" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nouvelle conversation" }).length).toBeGreaterThanOrEqual(1);
  });
});
