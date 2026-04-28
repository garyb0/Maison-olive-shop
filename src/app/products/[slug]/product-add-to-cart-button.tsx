"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";

const CART_STORAGE_KEY = "chezolive_cart_v1";

type CartLine = {
  productId: string;
  name?: string;
  quantity: number;
};

type Props = {
  productId: string;
  productName: string;
  language: Language;
  disabled?: boolean;
  maxQuantity?: number;
};

export function ProductAddToCartButton({ productId, productName, language, disabled = false, maxQuantity = 99 }: Props) {
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const addToCart = () => {
    if (disabled) return;
    const safeQuantity = Math.max(1, Math.min(quantity, Math.max(1, maxQuantity)));

    const raw = localStorage.getItem(CART_STORAGE_KEY);
    let current: CartLine[] = [];

    if (raw) {
      try {
        current = JSON.parse(raw) as CartLine[];
      } catch {
        current = [];
      }
    }

    const existing = current.find((line) => line.productId === productId);
    const next = existing
      ? current.map((line) =>
          line.productId === productId
            ? { ...line, quantity: line.quantity + safeQuantity, name: line.name ?? productName }
            : line,
        )
      : [...current, { productId, name: productName, quantity: safeQuantity }];

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: JSON.stringify(next) }));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="olive-product-buy-control">
      <label className="olive-product-qty-label" htmlFor={`qty-${productId}`}>
        {language === "fr" ? "Quantité" : "Quantity"}
      </label>
      <div className="olive-product-buy-row">
        <div className="cart-qty-control olive-product-qty-control">
          <button
            className="cart-qty-btn"
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={disabled || quantity <= 1}
            aria-label={language === "fr" ? "Diminuer la quantité" : "Decrease quantity"}
          >
            -
          </button>
          <input
            id={`qty-${productId}`}
            className="cart-qty-input"
            type="number"
            min={1}
            max={Math.max(1, maxQuantity)}
            value={quantity}
            onChange={(event) => {
              const nextQuantity = Math.max(1, Math.min(Number(event.target.value) || 1, Math.max(1, maxQuantity)));
              setQuantity(nextQuantity);
            }}
            disabled={disabled}
          />
          <button
            className="cart-qty-btn"
            type="button"
            onClick={() => setQuantity((current) => Math.min(Math.max(1, maxQuantity), current + 1))}
            disabled={disabled || quantity >= Math.max(1, maxQuantity)}
            aria-label={language === "fr" ? "Augmenter la quantité" : "Increase quantity"}
          >
            +
          </button>
        </div>
        <button
          className="btn olive-product-add-btn"
          type="button"
          disabled={disabled}
          onClick={addToCart}
        >
          {disabled
            ? language === "fr"
              ? "Indisponible"
              : "Unavailable"
            : added
              ? language === "fr"
                ? "Ajouté au panier"
                : "Added to cart"
              : language === "fr"
                ? "Ajouter au panier"
                : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
