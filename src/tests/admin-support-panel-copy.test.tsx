import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";

const longTicketMessage =
  "Bonjour, je veux expliquer un probleme assez long avec ma commande, la livraison et le suivi pour confirmer que le contenu du ticket reste lisible sans etre pousse sous les cartes de contexte.";

describe("AdminSupportPanel French copy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          conversations: [
            {
              id: "conv_open",
              customerEmail: "actif@example.com",
              customerName: "Client Actif",
              status: "OPEN",
              lastMessageAt: "2026-04-28T12:00:00.000Z",
              messages: [
                {
                  id: "msg_open",
                  senderType: "CUSTOMER",
                  content: longTicketMessage,
                  createdAt: "2026-04-28T12:00:00.000Z",
                },
              ],
            },
            {
              id: "conv_closed",
              customerEmail: "ferme@example.com",
              customerName: "Client Ferme",
              status: "CLOSED",
              lastMessageAt: "2026-04-27T12:00:00.000Z",
              messages: [],
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche le statut ferme avec accent dans le filtre ferme", async () => {
    render(<AdminSupportPanel language="fr" />);

    expect(await screen.findByText("Client Actif")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermées" }));

    expect(await screen.findByText("Client Ferme")).toBeInTheDocument();
    expect(screen.getByText("Fermée")).toBeInTheDocument();
    expect(screen.queryByText("Fermee")).not.toBeInTheDocument();
  });

  it("affiche les messages du ticket comme premier contenu du detail", async () => {
    const { container } = render(<AdminSupportPanel language="fr" />);

    expect(await screen.findByText("Client Actif")).toBeInTheDocument();

    await waitFor(() => {
      const detailScroll = container.querySelector(".support-admin-detail-scroll");
      expect(detailScroll?.firstElementChild).toHaveClass("support-admin-messages");
    });

    const messageBubble = await screen.findByText(longTicketMessage);
    expect(messageBubble).toHaveTextContent(longTicketMessage);
    expect(messageBubble).toHaveClass("support-msg-bubble");
  });
});
