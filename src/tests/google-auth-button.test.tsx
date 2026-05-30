export {};

import { render, screen } from "@testing-library/react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

describe("GoogleAuthButton", () => {
  it("affiche le libelle francais et encode le retour", () => {
    render(<GoogleAuthButton language="fr" returnTo="/checkout" />);

    const link = screen.getByRole("link", { name: /continuer avec google/i });
    expect(link).toHaveAttribute("href", "/api/auth/google/start?returnTo=%2Fcheckout");
  });

  it("affiche le libelle anglais", () => {
    render(<GoogleAuthButton language="en" returnTo="/account/orders" />);

    expect(screen.getByRole("link", { name: /continue with google/i })).toHaveAttribute(
      "href",
      "/api/auth/google/start?returnTo=%2Faccount%2Forders",
    );
  });
});
