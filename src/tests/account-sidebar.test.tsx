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

  it("garde uniquement la navigation laterale et marque la page active", () => {
    navigationMock.pathname = "/account/orders/order_1";

    const { container } = render(<AccountSidebar language="fr" />);
    const activeLink = container.querySelector(".account-sidebar__nav--desktop .admin-nav-item.active");

    expect(activeLink).toHaveAttribute("href", "/account/orders");
    expect(activeLink).toHaveTextContent("Mes commandes");
    expect(container.querySelector(".account-mobile-account-nav")).not.toBeInTheDocument();
  });

  it("deconnecte avec le endpoint existant depuis la navigation laterale", async () => {
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
