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

  it("montre le rappel panier dans l'app quand un panier local existe", () => {
    localStorage.setItem("chezolive_cart_v1", JSON.stringify([
      { productId: "prod_1", quantity: 2 },
      { productId: "prod_2", quantity: 1 },
    ]));

    render(<CartResumeBanner language="fr" />);

    expect(screen.getByText("Panier en cours")).toBeInTheDocument();
    expect(screen.getByText(/3 articles/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reprendre" })).toHaveAttribute("href", "/cart");
  });
});
