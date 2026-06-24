"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";
import { NavIcon } from "@/components/NavIcon";

type Props = {
  language: Language;
};

type CartLine = {
  productId: string;
  quantity: number;
};

const CART_STORAGE_KEY = "chezolive_cart_v1";

function readCartCount() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return 0;
    const lines = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0), 0);
  } catch {
    return 0;
  }
}

export function CartResumeBanner({ language }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(readCartCount());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  if (count <= 0) return null;

  return (
    <section className="pwa-cart-resume-banner" aria-live="polite">
      <span className="pwa-cart-resume-banner__icon">
        <NavIcon name="cart" size={22} />
      </span>
      <div>
        <strong>{language === "fr" ? "Panier en cours" : "Cart in progress"}</strong>
        <p>
          {language === "fr"
            ? `${count} article${count > 1 ? "s" : ""} à vérifier avant de commander.`
            : `${count} item${count > 1 ? "s" : ""} to review before checkout.`}
        </p>
      </div>
      <Link className="btn" href="/cart">
        {language === "fr" ? "Reprendre" : "Resume"}
      </Link>
    </section>
  );
}
