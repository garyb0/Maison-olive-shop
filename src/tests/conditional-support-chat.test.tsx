import { render, screen } from "@testing-library/react";
import { ConditionalSupportChat } from "@/components/ConditionalSupportChat";

let pathnameMock = "/";
const supportWidgetMock = vi.hoisted(() =>
  vi.fn(({ showFloatingButton = true }: { showFloatingButton?: boolean }) => (
    <div data-floating={String(showFloatingButton)} data-testid="support-widget" />
  )),
);

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
}));

vi.mock("@/components/SupportChatWidget", () => ({
  SupportChatWidget: supportWidgetMock,
}));

describe("ConditionalSupportChat", () => {
  beforeEach(() => {
    pathnameMock = "/";
    supportWidgetMock.mockClear();
  });

  it("cache le support flottant sur les routes chauffeur", () => {
    pathnameMock = "/driver/run/token_123";

    render(<ConditionalSupportChat language="fr" user={null} />);

    expect(screen.queryByTestId("support-widget")).not.toBeInTheDocument();
  });

  it("affiche le support flottant sur les routes client et publiques", () => {
    for (const route of ["/app", "/account/orders", "/boutique", "/products/shampoing", "/cart", "/checkout", "/login"]) {
      pathnameMock = route;

      const { unmount } = render(<ConditionalSupportChat language="fr" user={null} />);

      expect(screen.getByTestId("support-widget")).toHaveAttribute("data-floating", "true");
      unmount();
    }
  });

  it("ne monte pas le widget global sur la page support du compte", () => {
    pathnameMock = "/account/support";

    render(<ConditionalSupportChat language="fr" user={null} />);

    expect(screen.queryByTestId("support-widget")).not.toBeInTheDocument();
  });

  it("cache le support flottant sur les routes reservees", () => {
    for (const route of ["/admin", "/admin/support", "/driver/run/token_123", "/dog/public_123"]) {
      pathnameMock = route;

      const { unmount } = render(<ConditionalSupportChat language="fr" user={null} />);

      expect(screen.queryByTestId("support-widget")).not.toBeInTheDocument();
      unmount();
    }
  });
});
