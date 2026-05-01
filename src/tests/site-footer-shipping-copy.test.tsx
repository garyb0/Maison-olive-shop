import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/SiteFooter";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("SiteFooter shipping copy", () => {
  it("affiche une politique de livraison publique sans montant fige", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        /Livraison locale à Rimouski et environs\. Les frais et le seuil gratuit sont confirmés au panier et au passage à la caisse\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/8,99 \$ CAD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/24 à 72h/)).not.toBeInTheDocument();
  });
});
