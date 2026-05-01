import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SupportChatWidget } from "@/components/SupportChatWidget";

describe("SupportChatWidget French copy", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          adminAvailable: true,
          activeConversation: {
            id: "conv_1",
            status: "ASSIGNED",
            customerEmail: "client@example.com",
            customerName: "Client Invite",
            closedAt: null,
            messages: [
              {
                id: "msg_1",
                senderType: "CUSTOMER",
                content: "Bonjour",
                createdAt: "2026-04-28T12:00:00.000Z",
              },
            ],
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche les libelles francais accentues pour un client connecte", async () => {
    render(
      <SupportChatWidget
        language="fr"
        user={{ firstName: "Client", lastName: "Invite", email: "client@example.com", role: "CUSTOMER" }}
      />,
    );

    await waitFor(() => expect(screen.getByText("Réponse ici")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Aide" }));

    expect(await screen.findByText("Connecté en tant que")).toBeInTheDocument();
    expect(screen.getByText("Équipe en cours")).toBeInTheDocument();
  });
});
