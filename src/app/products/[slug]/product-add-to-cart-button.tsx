"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";
import { trackConversionEvent } from "@/lib/conversion-tracker";
import {
  findVariantForOptions,
  getVariantColorKey,
  getVariantColorLabel,
  getVariantDisplayName,
  getVariantOptionLabel,
  getVariantSizeKey,
  getVariantSizeOptions,
  getVariantsForSize,
  type PublicProductVariant,
} from "@/lib/product-variants";

const CART_STORAGE_KEY = "chezolive_cart_v1";

type CartLine = {
  productId: string;
  variantId?: string | null;
  name?: string;
  quantity: number;
};

type Props = {
  productId: string;
  productSlug?: string;
  productName: string;
  language: Language;
  priceLabel?: string;
  disabled?: boolean;
  maxQuantity?: number;
  variants?: PublicProductVariant[];
};

export function ProductAddToCartButton({
  productId,
  productSlug,
  productName,
  language,
  priceLabel,
  disabled = false,
  maxQuantity = 99,
  variants = [],
}: Props) {
  const activeVariants = variants.filter((variant) => variant.isActive !== false);
  const firstAvailableVariant = activeVariants.find((variant) => variant.stock > 0) ?? activeVariants[0] ?? null;
  const sizeOptions = getVariantSizeOptions(activeVariants, language);
  const hasSizeOptions = sizeOptions.length > 0;
  const initialSizeKey = firstAvailableVariant ? getVariantSizeKey(firstAvailableVariant) ?? "" : "";
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [selectedSizeKey, setSelectedSizeKey] = useState(initialSizeKey);
  const [selectedVariantId, setSelectedVariantId] = useState(firstAvailableVariant?.id ?? "");
  const effectiveSizeKey = hasSizeOptions ? selectedSizeKey || sizeOptions[0]?.key || null : null;
  const visibleVariants = hasSizeOptions ? getVariantsForSize(activeVariants, effectiveSizeKey) : activeVariants;
  const selectedVariant =
    visibleVariants.find((variant) => variant.id === selectedVariantId) ??
    findVariantForOptions(activeVariants, { sizeKey: effectiveSizeKey }) ??
    firstAvailableVariant;
  const selectedSizeOption = sizeOptions.find((option) => option.key === effectiveSizeKey) ?? sizeOptions[0] ?? null;
  const hasVariants = activeVariants.length > 0;
  const effectiveMaxQuantity = hasVariants ? selectedVariant?.stock ?? 0 : maxQuantity;
  const effectiveDisabled = disabled || (hasVariants && (!selectedVariant || selectedVariant.stock <= 0));
  const effectiveName = selectedVariant
    ? getVariantDisplayName(productName, selectedVariant, language)
    : productName;
  const selectedVariantLabel = selectedVariant ? getVariantColorLabel(selectedVariant, language) : "";
  const selectedOptionLabel = selectedVariant ? getVariantOptionLabel(selectedVariant, language) : productName;
  const selectedVariantStockLabel = selectedVariant
    ? selectedVariant.stock > 0
      ? language === "fr"
        ? `${selectedVariantLabel}: ${selectedVariant.stock} en stock`
        : `${selectedVariantLabel}: ${selectedVariant.stock} available`
      : language === "fr"
        ? `${selectedVariantLabel}: rupture`
        : `${selectedVariantLabel}: out of stock`
    : "";
  const addButtonLabel = effectiveDisabled
    ? language === "fr"
      ? "Indisponible"
      : "Unavailable"
    : added
      ? language === "fr"
        ? "Ajouté au panier"
        : "Added to cart"
      : language === "fr"
        ? "Ajouter au panier"
        : "Add to cart";
  const stickyButtonLabel = effectiveDisabled
    ? language === "fr"
      ? "Indisponible"
      : "Unavailable"
    : added
      ? language === "fr"
        ? "Ajouté au panier"
        : "Added to cart"
      : language === "fr"
        ? "Ajouter au panier"
        : "Add to cart";

  useEffect(() => {
    document.body.classList.add("has-product-sticky-cta");

    const updateStickyState = () => {
      const isMobile =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(max-width: 760px)").matches
          : window.innerWidth <= 760;
      setStickyVisible(isMobile && window.scrollY > 420);
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);

    return () => {
      document.body.classList.remove("has-product-sticky-cta");
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  const addToCart = () => {
    if (effectiveDisabled) return;
    const safeQuantity = Math.max(1, Math.min(quantity, Math.max(1, effectiveMaxQuantity)));

    const raw = localStorage.getItem(CART_STORAGE_KEY);
    let current: CartLine[] = [];

    if (raw) {
      try {
        current = JSON.parse(raw) as CartLine[];
      } catch {
        current = [];
      }
    }

    const targetVariantId = selectedVariant?.id ?? null;
    const existing = current.find((line) => line.productId === productId && (line.variantId ?? null) === targetVariantId);
    const newLine: CartLine = targetVariantId
      ? { productId, variantId: targetVariantId, name: effectiveName, quantity: safeQuantity }
      : { productId, name: effectiveName, quantity: safeQuantity };
    const next = existing
      ? current.map((line) =>
          line.productId === productId && (line.variantId ?? null) === targetVariantId
            ? { ...line, quantity: line.quantity + safeQuantity, name: line.name ?? effectiveName }
            : line,
        )
      : [...current, newLine];

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: JSON.stringify(next) }));
    trackConversionEvent("CART_ADD", {
      productId,
      productSlug,
      quantity: safeQuantity,
      language,
      metadata: { surface: "product", variantId: targetVariantId },
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="olive-product-buy-control">
      {hasVariants ? (
        <div className="olive-product-options">
          {hasSizeOptions ? (
            <div className="olive-size-picker" aria-label={language === "fr" ? "Choisir une grandeur" : "Choose a size"}>
              <div className="olive-option-head">
                <strong>{language === "fr" ? "Grandeur" : "Size"}</strong>
                {selectedSizeOption ? <span>{selectedSizeOption.label}</span> : null}
              </div>
              {sizeOptions.length === 1 && selectedSizeOption ? (
                <div className="olive-size-static">
                  <span>{selectedSizeOption.label}</span>
                </div>
              ) : (
                <div className="olive-size-options">
                  {sizeOptions.map((option) => {
                    const isSelected = option.key === effectiveSizeKey;
                    return (
                      <button
                        key={option.key}
                        className={`olive-size-option${isSelected ? " olive-size-option--active" : ""}`}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          const currentColorKey = selectedVariant ? getVariantColorKey(selectedVariant) : null;
                          const nextVariant =
                            findVariantForOptions(activeVariants, { sizeKey: option.key, colorKey: currentColorKey }) ??
                            findVariantForOptions(activeVariants, { sizeKey: option.key });
                          setSelectedSizeKey(option.key);
                          setSelectedVariantId(nextVariant?.id ?? "");
                          setQuantity(1);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className="olive-variant-picker" aria-label={language === "fr" ? "Choisir une couleur" : "Choose a color"}>
            <div className="olive-variant-picker__head">
              <strong>{language === "fr" ? "Couleur" : "Color"}</strong>
              {selectedVariant ? <span>{selectedVariantStockLabel}</span> : null}
            </div>
            <div className="olive-variant-swatches">
              {visibleVariants.map((variant) => {
                const isSelected = variant.id === selectedVariant?.id;
                return (
                  <button
                    key={variant.id}
                    className={`olive-variant-swatch${isSelected ? " olive-variant-swatch--active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setQuantity(1);
                    }}
                    disabled={variant.stock <= 0}
                    title={getVariantOptionLabel(variant, language)}
                    aria-pressed={isSelected}
                  >
                    <span style={{ background: variant.colorHex || "#d8c7aa" }} />
                    <small>{getVariantColorLabel(variant, language)}</small>
                  </button>
                );
              })}
            </div>
            {selectedVariant?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="olive-variant-preview" src={selectedVariant.imageUrl} alt={effectiveName} />
            ) : selectedVariant ? (
              <p className="olive-variant-photo-note">
                {language === "fr"
                  ? `Photo du modèle. Couleur sélectionnée: ${getVariantColorLabel(selectedVariant, language)}.`
                  : `Model photo. Selected color: ${getVariantColorLabel(selectedVariant, language)}.`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <label className="olive-product-qty-label" htmlFor={`qty-${productId}`}>
        {language === "fr" ? "Quantité" : "Quantity"}
      </label>
      <div className="olive-product-buy-row">
        <div className="cart-qty-control olive-product-qty-control">
          <button
            className="cart-qty-btn"
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            disabled={effectiveDisabled || quantity <= 1}
            aria-label={language === "fr" ? "Diminuer la quantité" : "Decrease quantity"}
          >
            -
          </button>
          <input
            id={`qty-${productId}`}
            className="cart-qty-input"
            type="number"
            min={1}
            max={Math.max(1, effectiveMaxQuantity)}
            value={quantity}
            onChange={(event) => {
              const nextQuantity = Math.max(1, Math.min(Number(event.target.value) || 1, Math.max(1, effectiveMaxQuantity)));
              setQuantity(nextQuantity);
            }}
            disabled={effectiveDisabled}
          />
          <button
            className="cart-qty-btn"
            type="button"
            onClick={() => setQuantity((current) => Math.min(Math.max(1, effectiveMaxQuantity), current + 1))}
            disabled={effectiveDisabled || quantity >= Math.max(1, effectiveMaxQuantity)}
            aria-label={language === "fr" ? "Augmenter la quantité" : "Increase quantity"}
          >
            +
          </button>
        </div>
        <button
          className="btn olive-product-add-btn"
          type="button"
          disabled={effectiveDisabled}
          onClick={addToCart}
        >
          {addButtonLabel}
        </button>
      </div>
      {stickyVisible ? (
        <div className="olive-product-sticky-cta" role="region" aria-label={language === "fr" ? "Achat rapide" : "Quick purchase"}>
          <div>
            {priceLabel ? <strong>{priceLabel}</strong> : null}
            <span>{selectedOptionLabel}</span>
          </div>
          <button className="btn olive-product-sticky-cta__button" type="button" disabled={effectiveDisabled} onClick={addToCart}>
            {stickyButtonLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
