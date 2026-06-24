import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { CartResumeBanner } from "@/app/app/cart-resume-banner";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("CartResumeBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ne montre rien quand le panier local est vide", () => {
    const { container } = render(<CartResumeBanner language="fr" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Panier en cours")).not.toBeInTheDocument();
  });

  it("montre le rappel panier dans l'app quand un panier local existe", () => {
    localStorage.setItem("chezolive_cart_v1", JSON.stringify([
      { productId: "prod_1", quantity: 2 },
      { productId: "prod_2", quantity: 1 },
    ]));

    render(<CartResumeBanner language="fr" />);

    expect(screen.getByText("Panier en cours")).toBeInTheDocument();
    expect(screen.getByText(/3 articles/)).toBeInTheDocument();
    expect(screen.getByText(/avant de commander/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/cart");
  });
});
