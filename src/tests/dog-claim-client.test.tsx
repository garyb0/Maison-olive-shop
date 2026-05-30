import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DogClaimClient } from "@/app/dog/[publicToken]/dog-claim-client";
import type { CurrentUser } from "@/lib/types";

const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

const user: CurrentUser = {
  id: "user_1",
  email: "client@example.com",
  firstName: "Gary",
  lastName: "Client",
  role: "CUSTOMER",
  language: "fr",
};

describe("DogClaimClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ dog: { id: "dog_1", publicToken: "dog-token-001" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("active un collier avec les choix de visibilite du client", async () => {
    render(<DogClaimClient language="fr" publicToken="dog-token-001" user={user} />);

    fireEvent.change(screen.getByPlaceholderText("Nom du chien"), { target: { value: "Olive" } });
    fireEvent.change(screen.getByPlaceholderText("Numéro pour joindre le parent"), {
      target: { value: "418-555-1212" },
    });
    fireEvent.click(screen.getByLabelText("Afficher le bouton d'appel"));
    fireEvent.click(screen.getByLabelText("Afficher les notes importantes"));
    fireEvent.click(screen.getByRole("button", { name: "Activer ce collier" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/account/dogs", expect.any(Object)));

    const request = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(request.body ?? "{}")).toEqual(
      expect.objectContaining({
        publicToken: "dog-token-001",
        name: "Olive",
        ownerPhone: "418-555-1212",
        showPhonePublic: true,
        showNotesPublic: true,
      }),
    );
    expect(refreshMock).toHaveBeenCalled();
  });
});
