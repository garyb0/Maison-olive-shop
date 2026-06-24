import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/Navigation", () => ({
  Navigation: () => <nav aria-label="Navigation test" />,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: vi.fn().mockResolvedValue("fr"),
}));

vi.mock("@/lib/i18n", () => ({
  getDictionary: () => ({ brandName: "ChezOlive.ca" }),
}));

vi.mock("@/lib/business", () => ({
  getBusinessInfo: () => ({
    brand: "Chez Olive",
    supportEmail: "support@chezolive.ca",
    supportHours: "Lundi au vendredi, 9h à 17h",
    shippingPolicy: "Livraison à domicile à Rimouski et environs, confirmée au panier.",
  }),
}));

describe("FaqPage help center hub", () => {
  it("affiche les sections principales et les appels a l'action", async () => {
    const { default: FaqPage } = await import("@/app/faq/page");
    const { container } = render(await FaqPage());

    expect(screen.getByRole("heading", { name: "Comment peut-on t’aider ?" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Écrire à l’équipe" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ou par courriel: support@chezolive.ca").length).toBeGreaterThan(0);

    for (const id of ["livraison", "commandes", "paiement", "retours", "compte", "conditions"]) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
    expect(container.querySelector("#colliers-qr")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GÃ©rer mes chiens/ })).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Suivre ma commande/ })).toHaveAttribute("href", "/account/orders");
    expect(screen.getByRole("link", { name: /Voir la livraison à domicile/ })).toHaveAttribute("href", "/faq#livraison");
    expect(screen.getByRole("link", { name: /Retour ou problème/ })).toHaveAttribute("href", "/faq#retours");
  });

  it("declenche l'ouverture du widget support depuis le CTA principal", async () => {
    const onOpen = vi.fn();
    window.addEventListener("chezolive:support-open", onOpen);
    const { default: FaqPage } = await import("@/app/faq/page");

    render(await FaqPage());
    fireEvent.click(screen.getAllByRole("button", { name: "Écrire à l’équipe" })[0]);

    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener("chezolive:support-open", onOpen);
  });
});
