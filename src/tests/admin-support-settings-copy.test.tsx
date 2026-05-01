import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminSupportSettingsPage from "@/app/admin/support/settings/page";

const defaultPreferences = {
  emailNewConversation: true,
  emailNewMessage: true,
  emailConversationAssigned: true,
  emailDigest: "none",
};

function mockSettingsFetch(options?: { emailProviderConfigured?: boolean }) {
  const emailProviderConfigured = options?.emailProviderConfigured ?? false;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/admin/support/settings/test-email") && method === "POST") {
      return new Response(
        JSON.stringify(
          emailProviderConfigured
            ? { sent: true, to: "admin@chezolive.ca" }
            : { error: "Email provider is not configured" },
        ),
        {
          status: emailProviderConfigured ? 200 : 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.endsWith("/api/admin/support/settings") && method === "PATCH") {
      return new Response(
        JSON.stringify({
          preferences: JSON.parse(String(init?.body)),
          emailProviderConfigured,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        preferences: defaultPreferences,
        emailProviderConfigured,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AdminSupportSettingsPage copy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clarifie que les preferences sont serveur et que le test email requiert un fournisseur", async () => {
    mockSettingsFetch({ emailProviderConfigured: false });

    render(<AdminSupportSettingsPage />);

    expect(await screen.findByText("Courriel de test")).toBeInTheDocument();
    expect(screen.queryByText("Vérification locale")).not.toBeInTheDocument();
    expect(screen.queryByText("Simuler la confirmation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer un courriel de test" })).toBeDisabled();
    expect(screen.getByText(/Aucun fournisseur email n'est configuré/)).toBeInTheDocument();
    expect(screen.getByText("Les préférences sont sauvegardées pour ton compte admin.")).toBeInTheDocument();
  });

  it("sauvegarde les preferences et envoie un vrai test quand le fournisseur email est pret", async () => {
    const fetchMock = mockSettingsFetch({ emailProviderConfigured: true });

    render(<AdminSupportSettingsPage />);

    await screen.findByRole("button", { name: "Envoyer un courriel de test" });
    fireEvent.click(screen.getByLabelText(/Nouvelle conversation/));
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder les préférences" }));

    await screen.findByText("Préférences sauvegardées côté serveur.");
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      emailNewConversation: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Envoyer un courriel de test" }));

    expect(await screen.findByText("Courriel de test envoyé à admin@chezolive.ca.")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/support/settings/test-email", { method: "POST" });
    });
  });
});
