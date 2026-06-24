import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MobileAppChrome } from "@/components/MobileAppChrome";

const pathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
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

describe("MobileAppChrome", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/products/lit-douillet");
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rend le header APP et la barre mobile a cinq onglets pour un visiteur", async () => {
    render(<MobileAppChrome language="fr" userRole={null} />);

    expect(screen.getByRole("banner", { name: "En-tete application" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chez Olive App/ })).toHaveAttribute("href", "/app");
    await waitFor(() => expect(screen.getByRole("link", { name: "Panier 0" })).toHaveAttribute("href", "/cart"));

    const nav = screen.getByRole("navigation", { name: "Navigation application" });
    const links = within(nav).getAllByRole("link");

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app",
      "/boutique",
      "/login?returnTo=%2Faccount%2Forders",
      "/login?returnTo=%2Faccount%2Fsupport",
      "/login?returnTo=%2Faccount",
    ]);
    links.forEach((link) => expect(link.querySelector("svg")).not.toBeNull());

    expect(within(nav).getByRole("link", { name: "Boutique" })).toHaveClass("active");
  });
});
