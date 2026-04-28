import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

const getCurrentLanguageMock = vi.fn();
const getCurrentUserMock = vi.fn();
const getDogProfileByPublicTokenMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: (...args: unknown[]) => getCurrentLanguageMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/dogs", () => ({
  getDogProfileByPublicToken: (...args: unknown[]) => getDogProfileByPublicTokenMock(...args),
}));

describe("dog public page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCurrentLanguageMock.mockResolvedValue("fr");
    getCurrentUserMock.mockResolvedValue(null);
  });

  it("masque les informations sensibles en mode prive strict", async () => {
    getDogProfileByPublicTokenMock.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      publicToken: "dog-token-001",
      name: "Kratos",
      photoUrl: "/dogs/kratos.webp",
      ageLabel: "9 ans",
      ownerPhone: "4183183984",
      importantNotes: "Operation au cou",
      publicProfileEnabled: true,
      showPhotoPublic: false,
      showAgePublic: false,
      showPhonePublic: false,
      showNotesPublic: false,
      isActive: true,
      claimedAt: new Date("2026-04-19T12:00:00.000Z"),
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      updatedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const { default: DogPublicPage } = await import("@/app/dog/[publicToken]/page");
    const element = await DogPublicPage({ params: Promise.resolve({ publicToken: "dog-token-001" }) });
    render(element);

    expect(screen.getByRole("heading", { name: "Kratos" })).toBeInTheDocument();
    expect(screen.getByText("Les informations de contact sont privées pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText("9 ans")).not.toBeInTheDocument();
    expect(screen.queryByText("Operation au cou")).not.toBeInTheDocument();
    expect(screen.queryByText("4183183984")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Appeler mon parent" })).not.toBeInTheDocument();
  });

  it("affiche le bouton d'appel et les champs autorises", async () => {
    getDogProfileByPublicTokenMock.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      publicToken: "dog-token-001",
      name: "Kratos",
      photoUrl: "/dogs/kratos.webp",
      ageLabel: "9 ans",
      ownerPhone: "418 318-3984",
      importantNotes: "Operation au cou",
      publicProfileEnabled: true,
      showPhotoPublic: true,
      showAgePublic: true,
      showPhonePublic: true,
      showNotesPublic: true,
      isActive: true,
      claimedAt: new Date("2026-04-19T12:00:00.000Z"),
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      updatedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const { default: DogPublicPage } = await import("@/app/dog/[publicToken]/page");
    const element = await DogPublicPage({ params: Promise.resolve({ publicToken: "dog-token-001" }) });
    render(element);

    expect(screen.getByText("9 ans")).toBeInTheDocument();
    expect(screen.getByText("Operation au cou")).toBeInTheDocument();
    const callLink = screen.getByRole("link", { name: "Appeler mon parent" });
    expect(callLink).toHaveAttribute("href", "tel:4183183984");
  });

  it("ne montre pas le téléphone si le propriétaire n'a pas autorisé l'appel public", async () => {
    getDogProfileByPublicTokenMock.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      publicToken: "dog-token-001",
      name: "Kratos",
      photoUrl: "/dogs/kratos.webp",
      ageLabel: "9 ans",
      ownerPhone: "418-318-3984",
      importantNotes: "Operation au cou",
      publicProfileEnabled: true,
      showPhotoPublic: false,
      showAgePublic: true,
      showPhonePublic: false,
      showNotesPublic: false,
      isActive: true,
      claimedAt: new Date("2026-04-19T12:00:00.000Z"),
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      updatedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const { default: DogPublicPage } = await import("@/app/dog/[publicToken]/page");
    const element = await DogPublicPage({ params: Promise.resolve({ publicToken: "dog-token-001" }) });
    render(element);

    expect(screen.queryByRole("link", { name: "Appeler mon parent" })).not.toBeInTheDocument();
  });

  it("conserve l'etat suspendu quand le collier est inactif", async () => {
    getDogProfileByPublicTokenMock.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      publicToken: "dog-token-001",
      name: "Kratos",
      photoUrl: "/dogs/kratos.webp",
      ageLabel: "9 ans",
      ownerPhone: "4183183984",
      importantNotes: "Operation au cou",
      publicProfileEnabled: true,
      showPhotoPublic: true,
      showAgePublic: true,
      showPhonePublic: true,
      showNotesPublic: true,
      isActive: false,
      claimedAt: new Date("2026-04-19T12:00:00.000Z"),
      createdAt: new Date("2026-04-19T12:00:00.000Z"),
      updatedAt: new Date("2026-04-19T12:00:00.000Z"),
    });

    const { default: DogPublicPage } = await import("@/app/dog/[publicToken]/page");
    const element = await DogPublicPage({ params: Promise.resolve({ publicToken: "dog-token-001" }) });
    render(element);

    expect(screen.getByText("Ce médaillon est en pause")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Appeler mon parent" })).not.toBeInTheDocument();
  });
});
