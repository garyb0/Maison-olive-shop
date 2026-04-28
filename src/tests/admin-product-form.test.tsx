import type { ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminProductsClient } from "@/app/admin/products/admin-products-client";

const fetchMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
    <img alt={alt} src={src} {...props} />
  ),
}));

vi.mock("@/components/ImageSelector", () => ({
  ImageSelector: () => null,
}));

describe("admin product form", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("slugifie automatiquement le slug avant envoi", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          id: "prod_test",
          slug: "test-de-commande-stripe",
          category: "test",
          nameFr: "Test de commande Stripe",
          nameEn: "Stripe checkout test",
          descriptionFr: "Produit de validation Stripe.",
          descriptionEn: "Stripe validation product.",
          imageUrl: null,
          priceCents: 10,
          currency: "CAD",
          stock: 10,
          isActive: true,
          isSubscription: false,
          priceWeekly: null,
          priceBiweekly: null,
          priceMonthly: null,
          priceQuarterly: null,
          createdAt: "2026-04-20T12:00:00.000Z",
        },
      }),
    });

    const { container } = render(<AdminProductsClient language="fr" products={[]} inventoryMovements={[]} />);
    const form = container.querySelector("form");
    const inputs = form?.querySelectorAll("input");
    const textareas = form?.querySelectorAll("textarea");

    expect(form).not.toBeNull();
    expect(inputs).toBeDefined();
    expect(textareas).toBeDefined();

    const slugInput = inputs?.[0] as HTMLInputElement;
    const categoryInput = inputs?.[1] as HTMLInputElement;
    const nameFrInput = inputs?.[3] as HTMLInputElement;
    const nameEnInput = inputs?.[4] as HTMLInputElement;
    const priceInput = inputs?.[5] as HTMLInputElement;
    const currencyInput = inputs?.[6] as HTMLInputElement;
    const stockInput = inputs?.[7] as HTMLInputElement;
    const descriptionFrInput = textareas?.[0] as HTMLTextAreaElement;
    const descriptionEnInput = textareas?.[1] as HTMLTextAreaElement;

    fireEvent.change(slugInput, { target: { value: "Test de commande Stripe" } });
    expect(slugInput.value).toBe("test-de-commande-stripe");

    fireEvent.change(categoryInput, { target: { value: "test" } });
    fireEvent.change(nameFrInput, { target: { value: "Test de commande Stripe" } });
    fireEvent.change(nameEnInput, { target: { value: "Stripe checkout test" } });
    fireEvent.change(descriptionFrInput, { target: { value: "Produit de validation Stripe." } });
    fireEvent.change(descriptionEnInput, { target: { value: "Stripe validation product." } });
    fireEvent.change(priceInput, { target: { value: "10" } });
    fireEvent.change(currencyInput, { target: { value: "CAD" } });
    fireEvent.change(stockInput, { target: { value: "10" } });

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload.slug).toBe("test-de-commande-stripe");
    expect(screen.getByText("Produit créé.")).toBeInTheDocument();
  });

  it("archive les produits avec historique au lieu de proposer une suppression directe", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          id: "prod_archived",
          slug: "ptest",
          category: { name: "test" },
          nameFr: "ptest",
          nameEn: "ptest",
          descriptionFr: "Produit test",
          descriptionEn: "Test product",
          imageUrl: null,
          priceCents: 50,
          currency: "CAD",
          stock: 0,
          isActive: false,
          isSubscription: false,
          priceWeekly: null,
          priceBiweekly: null,
          priceMonthly: null,
          priceQuarterly: null,
          createdAt: "2026-04-22T12:00:00.000Z",
          _count: { orderItems: 10 },
        },
      }),
    });

    render(
      <AdminProductsClient
        language="fr"
        products={[
          {
            id: "prod_archived",
            slug: "ptest",
            category: "test",
            nameFr: "ptest",
            nameEn: "ptest",
            descriptionFr: "Produit test",
            descriptionEn: "Test product",
            imageUrl: null,
            priceCents: 50,
            currency: "CAD",
            stock: 0,
            isActive: true,
            isSubscription: false,
            priceWeekly: null,
            priceBiweekly: null,
            priceMonthly: null,
            priceQuarterly: null,
            orderHistoryCount: 10,
            createdAt: "2026-04-22T10:00:00.000Z",
          },
        ]}
        inventoryMovements={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Supprimer définitivement" })).not.toBeInTheDocument();
    expect(screen.getByText("Historique: 10 commande(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archiver" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/products");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(screen.getByText("Produit archivé et retiré de la vente.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archivés (1)" }));
    expect(screen.getByText("ARCHIVÉ")).toBeInTheDocument();
  });

  it("supprime définitivement un produit sans historique", async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    render(
      <AdminProductsClient
        language="fr"
        products={[
          {
            id: "prod_delete",
            slug: "test-delete",
            category: "test",
            nameFr: "test delete",
            nameEn: "test delete",
            descriptionFr: "Produit test",
            descriptionEn: "Test product",
            imageUrl: null,
            priceCents: 50,
            currency: "CAD",
            stock: 1,
            isActive: true,
            isSubscription: false,
            priceWeekly: null,
            priceBiweekly: null,
            priceMonthly: null,
            priceQuarterly: null,
            orderHistoryCount: 0,
            createdAt: "2026-04-22T10:00:00.000Z",
          },
        ]}
        inventoryMovements={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
    await waitFor(() => expect(screen.queryByText("test delete")).not.toBeInTheDocument());
    expect(screen.getByText("Produit supprimé définitivement.")).toBeInTheDocument();
  });
});
