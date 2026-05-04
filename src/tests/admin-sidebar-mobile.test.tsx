import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminSidebar } from "@/app/admin/admin-sidebar";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/admin/delivery/runs"));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("AdminSidebar mobile drawer", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    pathnameMock.mockReturnValue("/admin/delivery/runs");
  });

  it("affiche une barre mobile et ouvre un drawer admin complet", () => {
    const { container } = render(<AdminSidebar language="fr" />);
    const drawer = container.querySelector("#admin-mobile-drawer");

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    expect(drawer).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    expect(drawer).toHaveAttribute("aria-hidden", "false");
    expect(container.querySelector('.admin-mobile-drawer__link[href="/admin"]')).not.toBeNull();
    expect(container.querySelector('.admin-mobile-drawer__link[href="/admin/products"]')).not.toBeNull();
    expect(container.querySelector('.admin-mobile-drawer__link[href="/admin/delivery/runs"]')).not.toBeNull();
    expect(container.querySelector('.admin-mobile-drawer__link[href="/admin/support/settings"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fermer le menu admin" }));

    expect(drawer).toHaveAttribute("aria-hidden", "true");
  });
});
