import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { AccountSidebar } from "@/app/account/account-sidebar";

const navigationMock = vi.hoisted(() => ({
  pathname: "/account",
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useRouter: () => ({
    push: navigationMock.push,
    refresh: navigationMock.refresh,
  }),
}));

describe("AccountSidebar", () => {
  beforeEach(() => {
    navigationMock.pathname = "/account";
    navigationMock.push.mockReset();
    navigationMock.refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marque le tab mobile principal actif pour une page enfant de commandes", () => {
    navigationMock.pathname = "/account/orders/order_1";

    const { container } = render(<AccountSidebar language="fr" />);
    const activeTab = container.querySelector(".account-mobile-account-tab--active");

    expect(activeTab).toHaveAttribute("href", "/account/orders");
    expect(activeTab).toHaveTextContent("Commandes");
  });

  it("affiche le libelle actif dans Plus compte quand la page active est secondaire", () => {
    navigationMock.pathname = "/account/profile";

    const { container } = render(<AccountSidebar language="fr" />);
    const moreMenu = container.querySelector(".account-mobile-account-more");
    const trigger = container.querySelector(".account-mobile-account-more__trigger");
    const activeMoreItem = container.querySelector(".account-mobile-account-more__item--active");

    expect(moreMenu).toHaveClass("account-mobile-account-more--active");
    expect(trigger).toHaveTextContent("Profil et securite");
    expect(activeMoreItem).toHaveAttribute("href", "/account/profile");
  });

  it("deconnecte avec le endpoint existant depuis le menu mobile", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<AccountSidebar language="en" />);
    const logoutButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Sign out of account"),
    );

    expect(logoutButton).toBeTruthy();
    fireEvent.click(logoutButton as HTMLButtonElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" }));
    expect(navigationMock.push).toHaveBeenCalledWith("/");
    expect(navigationMock.refresh).toHaveBeenCalled();
  });
});
