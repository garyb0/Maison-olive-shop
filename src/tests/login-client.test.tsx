import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LoginClient } from "@/app/login/login-client";

const pushMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => {
    void priority;
    return createElement("img", { alt, src, ...props });
  },
}));

vi.mock("@/components/Navigation", () => ({
  Navigation: () => null,
}));

describe("LoginClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("affiche la creation de compte manuelle a droite", () => {
    render(<LoginClient googleOAuthEnabled={false} googleReturnTo="/account" />);

    const registerPanel = screen.getByRole("region", { name: /créer un compte/i });

    expect(screen.getByRole("heading", { name: /^connexion$/i })).toBeInTheDocument();
    expect(registerPanel).toBeInTheDocument();
    expect(within(registerPanel).getByText("Commandes")).toBeInTheDocument();
    expect(within(registerPanel).getByText("Historique")).toBeInTheDocument();
    expect(within(registerPanel).getByText("Adresses")).toBeInTheDocument();
    expect(within(registerPanel).getByText("Sauvegarde")).toBeInTheDocument();
    expect(within(registerPanel).getByText("Livraisons")).toBeInTheDocument();
    expect(within(registerPanel).getByText("Rappels")).toBeInTheDocument();
    expect(within(registerPanel).getByRole("button", { name: /créer mon compte/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google/i })).not.toBeInTheDocument();
  });

  it("affiche Google quand OAuth est configure", () => {
    render(<LoginClient googleOAuthEnabled googleReturnTo="/checkout" />);

    expect(screen.getByRole("link", { name: /continuer avec google/i })).toHaveAttribute(
      "href",
      "/api/auth/google/start?returnTo=%2Fcheckout",
    );
  });

  it("cree un compte manuel avec autoLogin et redirige vers returnTo", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "u_1", role: "CUSTOMER" }),
    });

    render(<LoginClient googleOAuthEnabled={false} googleReturnTo="/checkout" />);

    const registerPanel = screen.getByRole("region", { name: /créer un compte/i });
    fireEvent.change(within(registerPanel).getByLabelText("Prénom"), { target: { value: "Olive" } });
    fireEvent.change(within(registerPanel).getByLabelText("Nom"), { target: { value: "Client" } });
    fireEvent.change(within(registerPanel).getByLabelText("Courriel"), { target: { value: "olive@example.com" } });
    fireEvent.change(within(registerPanel).getByLabelText("Mot de passe"), { target: { value: "password123" } });
    fireEvent.submit(within(registerPanel).getByRole("button", { name: /créer mon compte/i }).closest("form")!);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/checkout"));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(init.body))).toEqual({
      email: "olive@example.com",
      password: "password123",
      firstName: "Olive",
      lastName: "Client",
      language: "fr",
      autoLogin: true,
    });
  });
});
