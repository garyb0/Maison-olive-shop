import { createElement, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AdminProductsClient } from "@/app/admin/products/admin-products-client";

const fetchMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ alt, src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    createElement("img", { alt, src, ...props }),
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
          sku: "TEST-TEST-DE-COMMANDE-STRIPE",
          barcode: null,
          category: "test",
          nameFr: "Test de commande Stripe",
          nameEn: "Stripe checkout test",
          descriptionFr: "Produit de validation Stripe.",
          descriptionEn: "Stripe validation product.",
          imageUrl: null,
          priceCents: 10,
          costCents: 0,
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
    const skuInput = inputs?.[1] as HTMLInputElement;
    const categoryInput = inputs?.[3] as HTMLInputElement;
    const nameFrInput = inputs?.[5] as HTMLInputElement;
    const nameEnInput = inputs?.[6] as HTMLInputElement;
    const priceInput = inputs?.[7] as HTMLInputElement;
    const costInput = inputs?.[8] as HTMLInputElement;
    const currencyInput = inputs?.[9] as HTMLInputElement;
    const stockInput = inputs?.[10] as HTMLInputElement;
    const descriptionFrInput = textareas?.[0] as HTMLTextAreaElement;
    const descriptionEnInput = textareas?.[1] as HTMLTextAreaElement;

    fireEvent.change(slugInput, { target: { value: "Test de commande Stripe" } });
    expect(slugInput.value).toBe("test-de-commande-stripe");
    expect(skuInput.value).toBe("GENERAL-TEST-DE-COMMANDE-STRIPE");

    fireEvent.change(categoryInput, { target: { value: "test" } });
    fireEvent.change(nameFrInput, { target: { value: "Test de commande Stripe" } });
    fireEvent.change(nameEnInput, { target: { value: "Stripe checkout test" } });
    fireEvent.change(descriptionFrInput, { target: { value: "Produit de validation Stripe." } });
    fireEvent.change(descriptionEnInput, { target: { value: "Stripe validation product." } });
    fireEvent.change(priceInput, { target: { value: "10" } });
    fireEvent.change(costInput, { target: { value: "0" } });
    fireEvent.change(currencyInput, { target: { value: "CAD" } });
    fireEvent.change(stockInput, { target: { value: "10" } });

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body));

    expect(payload.slug).toBe("test-de-commande-stripe");
    expect(payload.sku).toBe("TEST-TEST-DE-COMMANDE-STRIPE");
    expect(screen.getByText("Produit créé.")).toBeInTheDocument();
  });

  it("envoie une sous-categorie guidee avec le produit", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          id: "prod_harnais",
          slug: "harnais-test",
          sku: "ACCESSORIES-HARNAIS-TEST",
          barcode: null,
          category: { name: "Accessories" },
          subcategory: { slug: "harnais", nameFr: "Harnais", nameEn: "Harnesses" },
          nameFr: "Harnais test",
          nameEn: "Test harness",
          descriptionFr: "Produit de test.",
          descriptionEn: "Test product.",
          imageUrl: null,
          priceCents: 1299,
          costCents: 0,
          currency: "CAD",
          stock: 3,
          isActive: true,
          isSubscription: false,
          priceWeekly: null,
          priceBiweekly: null,
          priceMonthly: null,
          priceQuarterly: null,
          createdAt: "2026-04-20T12:00:00.000Z",
          _count: { orderItems: 0 },
        },
      }),
    });

    const { container } = render(<AdminProductsClient language="fr" products={[]} inventoryMovements={[]} />);
    const form = container.querySelector("form") as HTMLFormElement;
    const inputs = form.querySelectorAll("input");
    const textareas = form.querySelectorAll("textarea");
    const subcategorySelect = form.querySelector('select[name="subcategorySlug"]') as HTMLSelectElement;

    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: "harnais-test" } });
    fireEvent.change(inputs[3] as HTMLInputElement, { target: { value: "Accessories" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Harnais" })).toBeInTheDocument());
    fireEvent.change(subcategorySelect, { target: { value: "harnais" } });
    fireEvent.change(inputs[5] as HTMLInputElement, { target: { value: "Harnais test" } });
    fireEvent.change(inputs[6] as HTMLInputElement, { target: { value: "Test harness" } });
    fireEvent.change(textareas[0] as HTMLTextAreaElement, { target: { value: "Produit de test." } });
    fireEvent.change(textareas[1] as HTMLTextAreaElement, { target: { value: "Test product." } });
    fireEvent.change(inputs[7] as HTMLInputElement, { target: { value: "1299" } });
    fireEvent.change(inputs[8] as HTMLInputElement, { target: { value: "0" } });
    fireEvent.change(inputs[9] as HTMLInputElement, { target: { value: "CAD" } });
    fireEvent.change(inputs[10] as HTMLInputElement, { target: { value: "3" } });

    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      sku: "ACCESSORIES-HARNAIS-TEST",
      category: "Accessories",
      subcategorySlug: "harnais",
    });
    expect(screen.getByText("Harnais")).toBeInTheDocument();
  });

  it("signale les produits actifs a stock 0 et permet de les remettre achetables", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          id: "prod_lit",
          slug: "lit-douillet-anti-stress",
          category: { name: "Beds" },
          nameFr: "Lit douillet anti-stress",
          nameEn: "Cozy anti-stress bed",
          descriptionFr: "Lit test",
          descriptionEn: "Test bed",
          imageUrl: null,
          priceCents: 4999,
          currency: "CAD",
          stock: 5,
          isActive: true,
          isSubscription: false,
          priceWeekly: null,
          priceBiweekly: null,
          priceMonthly: null,
          priceQuarterly: null,
          createdAt: "2026-04-22T12:00:00.000Z",
          _count: { orderItems: 4 },
        },
        movement: {
          id: "movement_lit",
          productId: "prod_lit",
          quantityChange: 5,
          reason: "restock",
          order: null,
          product: {
            nameFr: "Lit douillet anti-stress",
            nameEn: "Cozy anti-stress bed",
          },
          createdAt: "2026-05-04T12:00:00.000Z",
        },
      }),
    });

    render(
      <AdminProductsClient
        language="fr"
        products={[
          {
            id: "prod_lit",
            slug: "lit-douillet-anti-stress",
            category: "Beds",
            nameFr: "Lit douillet anti-stress",
            nameEn: "Cozy anti-stress bed",
            descriptionFr: "Lit test",
            descriptionEn: "Test bed",
            imageUrl: null,
            priceCents: 4999,
            currency: "CAD",
            stock: 0,
            isActive: true,
            isSubscription: false,
            priceWeekly: null,
            priceBiweekly: null,
            priceMonthly: null,
            priceQuarterly: null,
            orderHistoryCount: 4,
            createdAt: "2026-04-22T10:00:00.000Z",
            variants: [],
          },
        ]}
        inventoryMovements={[]}
      />,
    );

    const stockSection = screen.getByRole("region", { name: "Produits actifs non achetables" });
    expect(within(stockSection).getByText("lit-douillet-anti-stress")).toBeInTheDocument();
    expect(within(stockSection).getByText("Stock: 0")).toBeInTheDocument();
    expect(within(stockSection).getByText("Achat bloque")).toBeInTheDocument();

    fireEvent.change(within(stockSection).getByLabelText("Variation stock"), { target: { value: "5" } });
    fireEvent.change(within(stockSection).getByLabelText("Raison"), { target: { value: "restock" } });
    fireEvent.click(within(stockSection).getByRole("button", { name: "Ajuster" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/products/stock");
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      productId: "prod_lit",
      quantityChange: 5,
      reason: "restock",
    });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Produits actifs non achetables" })).not.toBeInTheDocument(),
    );
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
          stock: 1,
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
            stock: 1,
            isActive: true,
            isSubscription: false,
            priceWeekly: null,
            priceBiweekly: null,
            priceMonthly: null,
            priceQuarterly: null,
            orderHistoryCount: 10,
            createdAt: "2026-04-22T10:00:00.000Z",
            variants: [],
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
    expect(screen.getByText("Archivé")).toBeInTheDocument();
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
            variants: [],
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

  it("met a jour puis retire la photo d'un produit existant", async () => {
    const updatedProduct = {
      id: "prod_image",
      slug: "shampoing-test",
      sku: "HYGIENE-SHAMPOING-TEST",
      barcode: null,
      category: { name: "Hygiene" },
      nameFr: "Shampoing test",
      nameEn: "Test shampoo",
      descriptionFr: "Produit test",
      descriptionEn: "Test product",
      imageUrl: "/Logo/new.png",
      priceCents: 1299,
      costCents: 0,
      currency: "CAD",
      stock: 4,
      isActive: true,
      isSubscription: false,
      priceWeekly: null,
      priceBiweekly: null,
      priceMonthly: null,
      priceQuarterly: null,
      createdAt: "2026-04-22T12:00:00.000Z",
      _count: { orderItems: 0 },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product: updatedProduct }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          product: {
            ...updatedProduct,
            imageUrl: null,
          },
        }),
      });

    const { container } = render(
      <AdminProductsClient
        language="fr"
        products={[
          {
            id: "prod_image",
            slug: "shampoing-test",
            sku: "HYGIENE-SHAMPOING-TEST",
            barcode: null,
            category: "Hygiene",
            nameFr: "Shampoing test",
            nameEn: "Test shampoo",
            descriptionFr: "Produit test",
            descriptionEn: "Test product",
            imageUrl: "/Logo/old.png",
            priceCents: 1299,
            costCents: 0,
            currency: "CAD",
            stock: 4,
            isActive: true,
            isSubscription: false,
            priceWeekly: null,
            priceBiweekly: null,
            priceMonthly: null,
            priceQuarterly: null,
            orderHistoryCount: 0,
            createdAt: "2026-04-22T10:00:00.000Z",
            variants: [],
          },
        ]}
        inventoryMovements={[]}
      />,
    );

    expect(screen.getByAltText("Photo de Shampoing test")).toHaveAttribute("src", "/Logo/old.png");

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    const imageInput = screen.getByLabelText("URL image (optionnel)") as HTMLInputElement;
    fireEvent.change(imageInput, { target: { value: "/Logo/new.png" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      id: "prod_image",
      imageUrl: "/Logo/new.png",
    });
    await waitFor(() => expect(screen.getByAltText("Photo de Shampoing test")).toHaveAttribute("src", "/Logo/new.png"));

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      id: "prod_image",
      imageUrl: null,
    });
  });
});
