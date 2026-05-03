import { render, screen } from "@testing-library/react";
import { ConditionalSupportChat } from "@/components/ConditionalSupportChat";

let pathnameMock = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
}));

vi.mock("@/components/SupportChatWidget", () => ({
  SupportChatWidget: () => <div data-testid="support-widget" />,
}));

describe("ConditionalSupportChat", () => {
  beforeEach(() => {
    pathnameMock = "/";
  });

  it("cache le support flottant sur les routes chauffeur", () => {
    pathnameMock = "/driver/run/token_123";

    render(<ConditionalSupportChat language="fr" user={null} />);

    expect(screen.queryByTestId("support-widget")).not.toBeInTheDocument();
  });

  it("laisse le support disponible sur le hub PWA", () => {
    pathnameMock = "/app";

    render(<ConditionalSupportChat language="fr" user={null} />);

    expect(screen.getByTestId("support-widget")).toBeInTheDocument();
  });
});
