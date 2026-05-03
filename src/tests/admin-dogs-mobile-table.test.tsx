import { render, screen } from "@testing-library/react";
import { AdminDogsClient } from "@/app/admin/dogs/admin-dogs-client";

describe("AdminDogsClient mobile table labels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expose des labels par cellule pour le rendu mobile en cartes", () => {
    const { container } = render(
      <AdminDogsClient
        language="fr"
        siteUrl="https://maisonolive.ca"
        dogs={[
          {
            id: "dog_1",
            publicToken: "DOGTOK123",
            name: "Olive",
            isActive: true,
            claimedAtLabel: "28 avril 2026",
            createdAtLabel: "28 avril 2026",
            ownerPhone: "4185551212",
            userId: "user_1",
            ownerName: "Client Invite",
            ownerEmail: "client@example.com",
          },
        ]}
      />,
    );

    expect(container.querySelector(".admin-mobile-table-wrap")).not.toBeNull();
    expect(container.querySelector(".admin-mobile-table")).not.toBeNull();
    expect(screen.getByText("DOGTOK123").closest("td")).toHaveAttribute("data-label", "QR");
    expect(screen.getByText("Olive").closest("td")).toHaveAttribute("data-label", "Chien");
    expect(screen.getByText("Client Invite").closest("td")).toHaveAttribute("data-label", "Propriétaire");
    expect(screen.getByText("Ouvrir").closest("td")).toHaveClass("admin-mobile-actions-cell");
  });
});
