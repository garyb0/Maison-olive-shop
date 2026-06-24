import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SupportChatWidget } from "@/components/SupportChatWidget";

function mockSupportStateWith(messages: Array<{ id: string; senderType: "CUSTOMER" | "ADMIN"; content: string }>) {
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
          messages: messages.map((message) => ({
            ...message,
            createdAt: "2026-04-28T12:00:00.000Z",
          })),
        },
      }),
    }),
  );
}

describe("SupportChatWidget French copy", () => {
  beforeEach(() => {
    mockSupportStateWith([
      {
        id: "msg_1",
        senderType: "CUSTOMER",
        content: "Bonjour",
      },
    ]);
  });

  afterEach(() => {
    document.body.classList.remove("support-lite-widget-open");
    vi.unstubAllGlobals();
  });

  it("affiche une bulle compacte avec icone et libelles francais accentues", async () => {
    const { container } = render(
      <SupportChatWidget
        language="fr"
        user={{ firstName: "Client", lastName: "Invite", email: "client@example.com", role: "CUSTOMER" }}
      />,
    );

    const floatingButton = await screen.findByRole("button", { name: "Ouvrir l'aide" });
    await waitFor(() => expect(screen.getByText("Réponse ici")).toBeInTheDocument());
    expect(floatingButton.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector(".support-lite-float")).toBeInTheDocument();

    fireEvent.click(floatingButton);

    expect(document.body).toHaveClass("support-lite-widget-open");
    expect(await screen.findByText("Connecté en tant que")).toBeInTheDocument();
    expect(screen.getByText("Équipe en cours")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Écris ton message")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Aide Chez Olive" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Réduire l'aide" }));

    expect(screen.queryByRole("dialog", { name: "Aide Chez Olive" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir l'aide" })).toBeInTheDocument();
    expect(document.body).not.toHaveClass("support-lite-widget-open");
  });

  it("ouvre la fenetre quand le centre d'aide declenche l'evenement support", async () => {
    render(
      <SupportChatWidget
        language="fr"
        user={{ firstName: "Client", lastName: "Invite", email: "client@example.com", role: "CUSTOMER" }}
      />,
    );

    await waitFor(() => expect(screen.getByText("Réponse ici")).toBeInTheDocument());

    window.dispatchEvent(new CustomEvent("chezolive:support-open"));

    expect(await screen.findByText("Connecté en tant que")).toBeInTheDocument();
  });

  it("ouvre la fenetre par evenement meme sans bouton flottant", async () => {
    render(
      <SupportChatWidget
        language="fr"
        showFloatingButton={false}
        user={{ firstName: "Client", lastName: "Invite", email: "client@example.com", role: "CUSTOMER" }}
      />,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.queryByRole("button", { name: "Ouvrir l'aide" })).not.toBeInTheDocument();

    fireEvent(window, new CustomEvent("chezolive:support-open"));

    expect(await screen.findByText("Connecté en tant que")).toBeInTheDocument();
  });

  it("affiche le badge des nouveaux messages admin sur la bulle fermee", async () => {
    mockSupportStateWith([
      {
        id: "msg_admin_1",
        senderType: "ADMIN",
        content: "Bonjour, je regarde ça.",
      },
    ]);

    render(
      <SupportChatWidget
        language="fr"
        user={{ firstName: "Client", lastName: "Invite", email: "client@example.com", role: "CUSTOMER" }}
      />,
    );

    const floatingButton = await screen.findByRole("button", { name: "Ouvrir l'aide" });
    await waitFor(() => expect(within(floatingButton).getByText("1")).toBeInTheDocument());
  });
});
