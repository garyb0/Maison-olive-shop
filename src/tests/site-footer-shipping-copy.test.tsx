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
  it("reprend le slogan familial de l'entete", () => {
    render(<SiteFooter />);

    expect(screen.getAllByText("De notre famille à la vôtre").length).toBeGreaterThan(0);
    expect(screen.getByText("De notre famille à la vôtre.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Une boutique animalière locale, des produits choisis avec soin et la livraison à domicile à Rimouski.",
      ),
    ).toBeInTheDocument();
  });

  it("affiche une politique de livraison publique sans montant fige", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        /Livraison à domicile à Rimouski et environs\. Les frais et le seuil gratuit sont confirmés au panier et au passage à la caisse\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Lundi au vendredi, 9h à 17h (heure de Montréal)")).toBeInTheDocument();
    expect(screen.queryByText(/8,99 \$ CAD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/24 à 72h/)).not.toBeInTheDocument();
  });

  it("affiche les libelles francais propres du footer", () => {
    render(<SiteFooter />);

    expect(screen.getByText("Confidentialité")).toBeInTheDocument();
    expect(screen.getByText("Suppression des données")).toBeInTheDocument();
    expect(screen.getByText(/Android: app Google Play en préparation/)).toBeInTheDocument();
    expect(screen.getByText("Ouvrir l'app")).toBeInTheDocument();
  });

  it("redirige les liens d'aide fragmentes vers les sections du centre d'aide", () => {
    const { container } = render(<SiteFooter />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/faq");
    expect(hrefs).toContain("/faq#livraison");
    expect(hrefs).toContain("/faq#retours");
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
    expect(hrefs).toContain("/data-deletion");
    expect(hrefs).toContain("/account");
    expect(hrefs).toContain("/app");
    expect(hrefs).not.toContain("/shipping");
    expect(hrefs).not.toContain("/returns");
  });
});
