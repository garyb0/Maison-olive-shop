import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Navigation } from "@/components/Navigation";
import { getDictionary } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    createElement("img", { alt, src, ...props }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Navigation mobile cart copy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_cart", quantity: 1 }]));
  });

  it("separe le libelle panier du compteur dans le menu mobile", async () => {
    const { container } = render(
      <Navigation language="fr" t={getDictionary("fr")} user={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));

    await waitFor(() => {
      expect(within(container).getAllByRole("link", { name: "Panier — 1 article" }).length).toBeGreaterThan(0);
    });

    const drawerCart = container.querySelector(".nav-drawer-link--cart");
    expect(drawerCart?.textContent?.replace(/\s+/g, " ")).toContain("Panier 1");
    expect(screen.getByRole("link", { name: "Ouvrir l'app Chez Olive" })).toHaveAttribute("href", "/app");
  });
});
