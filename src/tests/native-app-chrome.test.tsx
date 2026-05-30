import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { NativeAppChromeClient } from "@/components/NativeAppChromeClient";

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

describe("Native app chrome", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/boutique");
    localStorage.clear();
    document.body.className = "is-capacitor-native";
    document.documentElement.className = "is-capacitor-native";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a stable five-tab customer shell in native client routes", async () => {
    render(<NativeAppChromeClient language="fr" userRole="ADMIN" />);

    expect(await screen.findByRole("banner", { name: "En-tete application" })).toBeInTheDocument();
    await waitFor(() => expect(document.body).toHaveClass("has-native-client-chrome"));

    const nav = screen.getByRole("navigation", { name: "Navigation application" });
    const links = within(nav).getAllByRole("link");

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/app",
      "/boutique",
      "/account/orders",
      "/account/support",
      "/account",
    ]);
    expect(within(nav).queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });

  it("routes account tabs to login for guests", async () => {
    render(<NativeAppChromeClient language="fr" userRole={null} />);

    const nav = await screen.findByRole("navigation", { name: "Navigation application" });
    const hrefs = within(nav).getAllByRole("link").map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(["/app", "/boutique", "/login", "/login", "/login"]);
  });

  it.each([
    ["/app", "Accueil"],
    ["/boutique", "Boutique"],
    ["/products/shampoing-peau-sensible", "Boutique"],
    ["/account", "Compte"],
    ["/account/orders", "Commandes"],
    ["/account/orders/MO-20260505-9337", "Commandes"],
    ["/account/support", "Support"],
    ["/account/dogs", "Compte"],
    ["/account/profile", "Compte"],
    ["/account/subscriptions", "Compte"],
  ])("marks only %s active in the native bottom nav", async (pathname, expectedLabel) => {
    pathnameMock.mockReturnValue(pathname);

    render(<NativeAppChromeClient language="fr" userRole="ADMIN" />);

    const nav = await screen.findByRole("navigation", { name: "Navigation application" });
    const activeLabels = within(nav)
      .getAllByRole("link")
      .filter((link) => link.classList.contains("active"))
      .map((link) => link.textContent?.trim());

    expect(activeLabels).toEqual([expectedLabel]);
  });

  it("does not mount client chrome on admin, driver, or dog surfaces", () => {
    pathnameMock.mockReturnValue("/admin/orders");

    const { container } = render(<NativeAppChromeClient language="fr" userRole="ADMIN" />);

    expect(container).toBeEmptyDOMElement();
    expect(document.body).not.toHaveClass("has-native-client-chrome");
  });
});
