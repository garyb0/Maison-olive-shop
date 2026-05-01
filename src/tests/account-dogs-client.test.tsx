import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DogsClient } from "@/app/account/dogs/dogs-client";
import type { DogProfileAccount } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const dog: DogProfileAccount = {
  id: "dog_1",
  userId: "user_1",
  publicToken: "dog-token-001",
  name: "Olive",
  photoUrl: null,
  ageLabel: "2 ans",
  ownerPhone: "418-555-1212",
  importantNotes: null,
  publicProfileEnabled: true,
  showPhotoPublic: false,
  showAgePublic: false,
  showPhonePublic: false,
  showNotesPublic: false,
  isActive: true,
  claimedAt: "2026-04-29T12:00:00.000Z",
  createdAt: "2026-04-29T12:00:00.000Z",
  updatedAt: "2026-04-29T12:00:00.000Z",
};

describe("DogsClient", () => {
  it("met les chiens existants avant le panneau d'activation replié", () => {
    render(<DogsClient language="fr" initialDogs={[dog]} />);

    const dogsHeading = screen.getByRole("heading", { name: "Mes chiens" });

    expect(screen.getByRole("heading", { name: "Olive" })).toBeInTheDocument();
    expect(screen.queryByText("Token QR")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ajouter un collier QR" }));

    const claimHeading = screen.getByRole("heading", { name: "Ajouter un collier QR" });
    expect(screen.getByText("Token QR")).toBeInTheDocument();
    expect(dogsHeading.compareDocumentPosition(claimHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("propose d'activer un premier collier quand la liste est vide", () => {
    render(<DogsClient language="fr" initialDogs={[]} />);

    expect(screen.getByText("Aucun chien actif pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText("Token QR")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Activer mon premier collier" }));

    expect(screen.getByRole("heading", { name: "Ajouter un collier QR" })).toBeInTheDocument();
    expect(screen.getByText("Token QR")).toBeInTheDocument();
  });
});
