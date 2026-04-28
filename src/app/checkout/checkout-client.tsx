"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";
import type {
  CheckoutConfirmation,
  CurrentUser,
  DeliveryAddress,
  OrderCheckoutResponse,
  StripeInlineCheckoutSession,
} from "@/lib/types";
import {
  CANADIAN_PROVINCE_OPTIONS,
  COUNTRY_OPTIONS,
  getAddressOptionLabel,
  normalizeCountryCode,
  normalizePostalCodeInput,
  normalizeProvinceCode,
} from "@/lib/address-fields";
import { isRimouskiPostalCode } from "@/lib/delivery-zone";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";
import { StripeInlineCheckout } from "@/components/StripeInlineCheckoutSurface";
import { CheckoutSuccessView } from "@/components/CheckoutSuccessView";

type ProductIndex = Record<
  string,
  {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    priceLabel: string;
  }
>;

type Props = {
  language: Language;
  t: Dictionary;
  user: CurrentUser | null;
  productIndex: ProductIndex;
  initialDeliveryAddresses: DeliveryAddress[];
  shippingFlatCents: number;
  shippingFreeThresholdCents: number;
  initialConfirmation: CheckoutConfirmation | null;
  initialPaymentMode: "manual" | "stripe";
  initialStripeNotice: "paid" | "pending" | "cancelled" | null;
};

type CartLine = {
  productId: string;
  name?: string;
  quantity: number;
};

type CheckoutQuote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  gstCents: number;
  qstCents: number;
  taxCents: number;
  totalCents: number;
};

type DeliverySlotOption = {
  id: string;
  startAt: string;
  endAt: string;
  periodKey: DeliveryPeriodKey;
  periodLabel: string;
  capacity: number;
  reservedCount: number;
  remainingCapacity: number;
  isOpen: boolean;
  note: string | null;
  dateKey: string;
};

type DeliveryPeriodKey = "AM" | "PM";
type DeliveryPeriodSummary = {
  period: DeliveryPeriodKey;
  label: string;
  statusText: string;
  tone: "good" | "warn" | "full";
  slot: DeliverySlotOption | null;
  available: boolean;
};

const DELIVERY_PERIODS: DeliveryPeriodKey[] = ["AM", "PM"];

const CART_STORAGE_KEY = "chezolive_cart_v1";
const STRIPE_MINIMUM_TOTAL_CENTS = 50;

const formatCad = (cents: number, language: Language) =>
  new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);

const parseDateKeyAsLocalDate = (dateKey: string) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(dateKey);
  }

  return new Date(year, month - 1, day);
};

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDeliveryDayLabel = (dateKey: string, language: Language) =>
  new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDateKeyAsLocalDate(dateKey));

const getDeliveryPeriod = (slot: DeliverySlotOption): DeliveryPeriodKey => {
  return slot.periodKey;
};

const formatDeliveryPeriodLabel = (period: DeliveryPeriodKey, language: Language) => {
  if (period === "AM") return "AM";
  return "PM";
};

const formatAvailablePlaceCount = (count: number, language: Language) => {
  if (language === "fr") {
    const suffix = count > 1 ? "s" : "";
    return `${count} place${suffix} disponible${suffix}`;
  }

  return `${count} spot${count === 1 ? "" : "s"} available`;
};

const formatPeriodCount = (count: number, language: Language) => {
  if (language === "fr") {
    return `${count} période${count > 1 ? "s" : ""}`;
  }

  return `${count} period${count === 1 ? "" : "s"}`;
};

const getCalendarDays = (deliveryDays: Array<{ dateKey: string; label: string; statusText: string; tone: "good" | "warn" | "full"; periodCount: number }>) => {
  if (deliveryDays.length === 0) return [];

  const availableMap = new Map(deliveryDays.map((day) => [day.dateKey, day] as const));
  const startDate = parseDateKeyAsLocalDate(deliveryDays[0].dateKey);
  const offset = (startDate.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - offset);

  return Array.from({ length: 14 }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);
    const dateKey = formatLocalDateKey(current);
    const availableDay = availableMap.get(dateKey);
    return {
      dateKey,
      date: current,
      availableDay,
      isAvailable: Boolean(availableDay),
    };
  });
};

const normalizeDeliveryPhone = (value: string) => value.replace(/\D/g, "");
const normalizeAddressText = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const normalizeAddressPostal = (value: string) => value.replace(/\s+/g, "").trim().toUpperCase();

const getAddressIdentity = (input: {
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
}) => ({
  shippingLine1: normalizeAddressText(input.shippingLine1),
  shippingCity: normalizeAddressText(input.shippingCity),
  shippingRegion: normalizeAddressText(input.shippingRegion),
  shippingPostal: normalizeAddressPostal(input.shippingPostal),
  shippingCountry: normalizeAddressText(input.shippingCountry),
});

const addressesMatch = (
  left: {
    shippingLine1: string;
    shippingCity: string;
    shippingRegion: string;
    shippingPostal: string;
    shippingCountry: string;
  },
  right: {
    shippingLine1: string;
    shippingCity: string;
    shippingRegion: string;
    shippingPostal: string;
    shippingCountry: string;
  },
) => {
  const normalizedLeft = getAddressIdentity(left);
  const normalizedRight = getAddressIdentity(right);
  return (
    normalizedLeft.shippingLine1 === normalizedRight.shippingLine1 &&
    normalizedLeft.shippingCity === normalizedRight.shippingCity &&
    normalizedLeft.shippingRegion === normalizedRight.shippingRegion &&
    normalizedLeft.shippingPostal === normalizedRight.shippingPostal &&
    normalizedLeft.shippingCountry === normalizedRight.shippingCountry
  );
};

const formatAddressCardTitle = (address: DeliveryAddress, user: CurrentUser | null, language: Language) => {
  if (address.label && address.label.trim() && address.label.trim() !== address.shippingLine1.trim()) {
    return address.label;
  }

  if (user) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  return language === "fr" ? "Adresse enregistrée" : "Saved address";
};

const formatAddressCardLines = (address: DeliveryAddress) => ({
  main: address.shippingLine1,
  secondary: `${address.shippingCity}, ${address.shippingRegion}, ${address.shippingPostal}`,
  country: address.shippingCountry,
});

function AddressGlyph() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 14,
        border: "1px solid rgba(197, 170, 109, 0.26)",
        background: "linear-gradient(180deg, rgba(255, 251, 242, 0.98) 0%, rgba(248, 240, 224, 0.92) 100%)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        color: "#7a6946",
        flex: "0 0 auto",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="presentation">
        <path
          d="M5 10.2L12 4.5L19 10.2V18.2C19 18.64 18.64 19 18.2 19H14.5V14.7H9.5V19H5.8C5.36 19 5 18.64 5 18.2V10.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const isValidDeliveryPhone = (value: string) => {
  if (!value.trim()) {
    return false;
  }

  const digits = normalizeDeliveryPhone(value);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
};

export function CheckoutClient({
  language,
  t,
  user,
  productIndex,
  initialDeliveryAddresses,
  shippingFlatCents: _shippingFlatCents,
  shippingFreeThresholdCents: _shippingFreeThresholdCents,
  initialConfirmation,
  initialPaymentMode,
  initialStripeNotice,
}: Props) {
  const searchParams = useSearchParams();
  const [deliveryAddresses] = useState<DeliveryAddress[]>(initialDeliveryAddresses);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const [saveDeliveryAddress, setSaveDeliveryAddress] = useState(Boolean(user) && initialDeliveryAddresses.length === 0);
  const [guestCustomerName, setGuestCustomerName] = useState("");
  const [guestCustomerEmail, setGuestCustomerEmail] = useState("");
  const [deliveryAddressLabel, setDeliveryAddressLabel] = useState("");
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingRegion, setShippingRegion] = useState("QC");
  const [shippingPostal, setShippingPostal] = useState("");
  const [shippingCountry, setShippingCountry] = useState("CA");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"MANUAL" | "STRIPE">(user ? "MANUAL" : "STRIPE");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inlineConfirmation, setInlineConfirmation] = useState<CheckoutConfirmation | null>(initialConfirmation);
  const [pendingStripeConfirmation, setPendingStripeConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [inlinePaymentMode, setInlinePaymentMode] = useState<"manual" | "stripe">(
    initialConfirmation?.paymentMode ?? initialPaymentMode,
  );
  const [stripeSession, setStripeSession] = useState<(StripeInlineCheckoutSession & { fingerprint: string }) | null>(null);
  const [stripeReturnNotice, setStripeReturnNotice] = useState<"paid" | "pending" | "cancelled" | null>(
    initialStripeNotice,
  );
  const [addressError, setAddressError] = useState("");
  const [prefersNewDeliveryAddress, setPrefersNewDeliveryAddress] = useState(false);
  const [deliveryPhoneTouched, setDeliveryPhoneTouched] = useState(false);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlotOption[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<"legacy" | "dynamic">("legacy");
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(false);
  const [deliverySlotsError, setDeliverySlotsError] = useState("");
  const [selectedDeliverySlotId, setSelectedDeliverySlotId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedDeliveryPeriod, setSelectedDeliveryPeriod] = useState<DeliveryPeriodKey | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const isCreatingNewAddress = prefersNewDeliveryAddress || !selectedSavedAddressId;
  const selectedSavedAddress = deliveryAddresses.find((address) => address.id === selectedSavedAddressId) ?? null;
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestCustomerEmail.trim());

  const saveCart = (updated: CartLine[]) => {
    setCart(updated);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      saveCart(cart.filter((line) => line.productId !== productId));
      return;
    }

    saveCart(
      cart.map((line) => (
        line.productId === productId
          ? { ...line, quantity: qty }
          : line
      )),
    );
  };

  const remove = (productId: string) => {
    saveCart(cart.filter((line) => line.productId !== productId));
  };

  // Validation code postal en temps réel
  const postalTouched = shippingPostal.length >= 3;
  const postalValid = postalTouched ? isRimouskiPostalCode(shippingPostal) : true;
  const isDeliveryPhoneRequired = !selectedDeliverySlotId;
  const hasDeliveryPhoneValue = deliveryPhone.trim().length > 0;
  const isDeliveryPhoneInvalid = hasDeliveryPhoneValue && !isValidDeliveryPhone(deliveryPhone);
  const deliveryPhoneErrorMessage =
    language === "fr"
      ? isDeliveryPhoneRequired
        ? "Le num\u00e9ro de t\u00e9l\u00e9phone est requis pour planifier la livraison."
        : "Le num\u00e9ro de t\u00e9l\u00e9phone doit contenir 10 chiffres (ou 11 avec l'indicatif 1)."
      : isDeliveryPhoneRequired
        ? "A phone number is required to schedule delivery."
        : "Phone number must be 10 digits (or 11 with country code 1).";
  const showDeliveryPhoneError =
    isDeliveryPhoneRequired
      ? !hasDeliveryPhoneValue || isDeliveryPhoneInvalid
      : isDeliveryPhoneInvalid;

  useEffect(() => {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      setCart([]);
      return;
    }
    try {
      setCart(JSON.parse(raw) as CartLine[]);
    } catch {
      setCart([]);
    }
  }, []);

  const cartRows = useMemo(() => cart.map((line) => {
    const product = productIndex[line.productId];
    const lineSubtotalCents = (product?.priceCents ?? 0) * line.quantity;
    return {
      ...line,
      name: product?.name ?? line.name ?? (language === "fr" ? "Produit indisponible" : "Unavailable product"),
      priceLabel: product?.priceLabel ?? "-",
      lineSubtotalCents,
      lineSubtotalLabel: new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
        style: "currency",
        currency: product?.currency ?? "CAD",
      }).format(lineSubtotalCents / 100),
    };
  }), [cart, language, productIndex]);

  const subtotalCents = cartRows.reduce((acc, row) => acc + row.lineSubtotalCents, 0);
  const beforeTaxCents = Math.max(0, subtotalCents - (quote?.discountCents ?? 0)) + (quote?.shippingCents ?? 0);
  const subtotalLabel = formatCad(subtotalCents, language);
  const trimmedPromoCode = promoCode.trim().toUpperCase();
  const promoApplied = Boolean(quote && quote.discountCents > 0);
  const checkoutFingerprint = useMemo(
    () =>
      JSON.stringify({
        items: cartRows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
        paymentMethod,
        guestCustomerName: guestCustomerName.trim(),
        guestCustomerEmail: guestCustomerEmail.trim().toLowerCase(),
        promoCode: trimmedPromoCode,
        deliveryAddressId: selectedSavedAddressId,
        saveDeliveryAddress,
        deliveryAddressLabel: deliveryAddressLabel.trim(),
        shippingLine1: shippingLine1.trim(),
        shippingCity: shippingCity.trim(),
        shippingRegion: shippingRegion.trim(),
        shippingPostal: shippingPostal.trim(),
        shippingCountry: shippingCountry.trim(),
        deliverySlotId: selectedDeliverySlotId,
        deliveryInstructions: deliveryInstructions.trim(),
        deliveryPhone: deliveryPhone.trim(),
      }),
    [
      cartRows,
      paymentMethod,
      guestCustomerName,
      guestCustomerEmail,
      trimmedPromoCode,
      selectedSavedAddressId,
      saveDeliveryAddress,
      deliveryAddressLabel,
      shippingLine1,
      shippingCity,
      shippingRegion,
      shippingPostal,
      shippingCountry,
      selectedDeliverySlotId,
      deliveryInstructions,
      deliveryPhone,
    ],
  );
  const deliveryDays = useMemo(() => Array.from(new Set(deliverySlots.map((slot) => slot.dateKey))).map((dateKey) => {
    const daySlots = deliverySlots.filter((slot) => slot.dateKey === dateKey);
    const totalRemaining = daySlots.reduce((sum, slot) => sum + slot.remainingCapacity, 0);
    const totalCapacity = daySlots.reduce((sum, slot) => sum + slot.capacity, 0);
    const fillRate = totalCapacity > 0 ? totalRemaining / totalCapacity : 0;

    let tone: "good" | "warn" | "full" = "good";
    let statusText = formatAvailablePlaceCount(totalRemaining, language);

    if (fillRate <= 0) {
      tone = "full";
      statusText = language === "fr" ? "Complet" : "Full";
    } else if (fillRate <= 0.35) {
      tone = "warn";
      statusText = language === "fr" ? "Presque complet" : "Almost full";
    }

    return {
      dateKey,
      label: formatDeliveryDayLabel(dateKey, language),
      statusText,
      tone,
      periodCount: Array.from(new Set(daySlots.map((slot) => getDeliveryPeriod(slot)))).length,
    };
  }), [deliverySlots, language]);
  const selectedSlot = useMemo(
    () => deliverySlots.find((slot) => slot.id === selectedDeliverySlotId) ?? null,
    [deliverySlots, selectedDeliverySlotId],
  );
  const selectedDaySlots = useMemo(
    () => deliverySlots.filter((slot) => slot.dateKey === selectedDateKey),
    [deliverySlots, selectedDateKey],
  );
  const selectedDayPeriods = useMemo(() => {
    return DELIVERY_PERIODS
      .map((period): DeliveryPeriodSummary => {
        const periodSlots = selectedDaySlots.filter((slot) => getDeliveryPeriod(slot) === period);
        if (!periodSlots.length) {
          return {
            period,
            label: formatDeliveryPeriodLabel(period, language),
            statusText: language === "fr" ? "Indisponible" : "Unavailable",
            tone: "full",
            slot: null,
            available: false,
          };
        }

        const totalRemaining = periodSlots.reduce((sum, slot) => sum + slot.remainingCapacity, 0);
        let tone: "good" | "warn" | "full" = "good";
        let statusText = formatAvailablePlaceCount(totalRemaining, language);

        if (totalRemaining <= 0) {
          tone = "full";
          statusText = language === "fr" ? "Complet" : "Full";
        } else if (totalRemaining <= 2) {
          tone = "warn";
          statusText = language === "fr" ? "Disponibilité limitée" : "Limited availability";
        }

        return {
          period,
          label: formatDeliveryPeriodLabel(period, language),
          statusText,
          tone,
          slot: periodSlots[0],
          available: totalRemaining > 0,
        };
      });
  }, [language, selectedDaySlots]);
  const calendarDays = useMemo(() => getCalendarDays(deliveryDays), [deliveryDays]);
  const deliveryStepLabel = !shippingPostal.trim()
    ? (language === "fr" ? "Entre ton code postal pour afficher les options." : "Enter your postal code to load delivery options.")
      : !postalValid
      ? (language === "fr" ? "Nous n'affichons pas de périodes hors zone de livraison." : "We only show delivery periods inside the delivery area.")
      : !selectedDateKey
        ? (language === "fr" ? "Choisis une journée de livraison." : "Choose a delivery day.")
        : !selectedDeliveryPeriod
          ? (language === "fr" ? "Choisis maintenant AM ou PM." : "Now choose AM or PM.")
          : (language === "fr" ? "Ta période de livraison est prête. Tu peux finaliser la commande." : "Your delivery period is ready. You can finish checkout.");

  const applyDeliveryAddress = (address: DeliveryAddress) => {
    setPrefersNewDeliveryAddress(false);
    setSelectedSavedAddressId(address.id);
    setDeliveryAddressLabel(address.label);
    setShippingLine1(address.shippingLine1);
    setShippingCity(address.shippingCity);
    setShippingRegion(normalizeProvinceCode(address.shippingRegion));
    setShippingPostal(normalizePostalCodeInput(address.shippingPostal));
    setShippingCountry(normalizeCountryCode(address.shippingCountry));
    setDeliveryPhone(address.deliveryPhone ?? "");
    setDeliveryInstructions(address.deliveryInstructions ?? "");
    setSaveDeliveryAddress(false);
    setAddressError("");
  };

  const startNewDeliveryAddress = () => {
    setPrefersNewDeliveryAddress(true);
    setSelectedSavedAddressId("");
    setDeliveryAddressLabel("");
    setSaveDeliveryAddress(Boolean(user));
    setShippingLine1("");
    setShippingCity("");
    setShippingRegion("QC");
    setShippingPostal("");
    setShippingCountry("CA");
    setDeliveryPhone("");
    setDeliveryInstructions("");
    setAddressError("");
  };

  useEffect(() => {
    if (!user || deliveryAddresses.length === 0 || selectedSavedAddressId || prefersNewDeliveryAddress) {
      return;
    }

    const hasTypedAddress =
      [shippingLine1, shippingCity, shippingPostal, deliveryPhone, deliveryInstructions]
        .some((value) => value.trim().length > 0) ||
      (shippingRegion.trim().length > 0 && normalizeProvinceCode(shippingRegion) !== "QC") ||
      (shippingCountry.trim().length > 0 && normalizeCountryCode(shippingCountry) !== "CA");

    if (hasTypedAddress) {
      return;
    }

    applyDeliveryAddress(deliveryAddresses[0]);
  }, [
    deliveryAddresses,
    deliveryInstructions,
    deliveryPhone,
    selectedSavedAddressId,
    shippingCity,
    shippingLine1,
    shippingPostal,
    shippingRegion,
    user,
    prefersNewDeliveryAddress,
  ]);

  useEffect(() => {
    const queryPromo = searchParams.get("promoCode")?.trim().toUpperCase();
    if (queryPromo) {
      setPromoCode((current) => current || queryPromo);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      setMessage("");
      setError(
        language === "fr"
          ? "Le paiement par carte a été annulé. Vous pouvez reprendre le checkout quand vous voulez."
          : "Card checkout was cancelled. You can resume checkout anytime.",
      );
      setStripeReturnNotice("cancelled");
    }
  }, [language, searchParams]);

  useEffect(() => {
    if (!inlineConfirmation) {
      return;
    }

    localStorage.removeItem(CART_STORAGE_KEY);
    setCart([]);
  }, [inlineConfirmation]);

  useEffect(() => {
    if (!stripeSession || stripeSession.fingerprint === checkoutFingerprint) {
      return;
    }

    setStripeSession(null);
    setMessage(
      language === "fr"
        ? "Le paiement intégré a été réinitialisé pour refléter les dernières modifications de la commande."
        : "Inline payment was reset to reflect your latest order changes.",
    );
  }, [checkoutFingerprint, language, stripeSession]);

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();

    const loadQuote = async () => {
      try {
        const response = await fetch("/api/orders/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.map((row) => ({ productId: row.productId, quantity: row.quantity })),
            shippingPostal,
            shippingCountry,
            promoCode: trimmedPromoCode || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setQuote(null);
          return;
        }

        const data = (await response.json()) as { quote?: CheckoutQuote };
        setQuote(data.quote ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setQuote(null);
        }
      }
    };

    void loadQuote();

    return () => controller.abort();
  }, [cart, shippingCountry, shippingPostal, trimmedPromoCode]);

  useEffect(() => {
    const postal = shippingPostal.trim();
    const country = shippingCountry.trim().toUpperCase() || "CA";

    if (!postal || !isRimouskiPostalCode(postal) || country !== "CA") {
      setDeliverySlots([]);
      setDeliveryMode("legacy");
      setSelectedDeliverySlotId("");
      setSelectedDeliveryPeriod(null);
      setDeliverySlotsError("");
      setDeliverySlotsLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadSlots = async () => {
      setDeliverySlotsLoading(true);
      setDeliverySlotsError("");

      try {
        const params = new URLSearchParams({
          postalCode: postal,
          country,
        });
        const response = await fetch(`/api/delivery/slots?${params.toString()}`, {
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as {
          mode?: "legacy" | "dynamic";
          slots?: DeliverySlotOption[];
          error?: string;
        };

        if (!response.ok) {
          setDeliverySlots([]);
          setSelectedDeliverySlotId("");
          setSelectedDeliveryPeriod(null);
          setDeliverySlotsError(
            data.error ??
              (language === "fr"
                ? "Impossible de charger les périodes de livraison pour le moment."
                : "Unable to load delivery periods right now."),
          );
          return;
        }

        const slots = data.slots ?? [];
        setDeliveryMode(data.mode === "dynamic" ? "dynamic" : "legacy");
        setDeliverySlots(slots);
        
        // Auto sélectionner le premier jour disponible par défaut
        if (slots.length > 0) {
          setSelectedDateKey(slots[0].dateKey);
          setSelectedDeliverySlotId(slots[0].id);
          setSelectedDeliveryPeriod(getDeliveryPeriod(slots[0]));
        } else {
          setSelectedDateKey(null);
          setSelectedDeliverySlotId("");
          setSelectedDeliveryPeriod(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setDeliverySlots([]);
          setDeliveryMode("legacy");
          setSelectedDeliverySlotId("");
          setSelectedDeliveryPeriod(null);
          setDeliverySlotsError(
            language === "fr"
              ? "Impossible de charger les périodes de livraison pour le moment."
              : "Unable to load delivery periods right now.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDeliverySlotsLoading(false);
        }
      }
    };

    void loadSlots();

    return () => controller.abort();
  }, [language, shippingCountry, shippingPostal]);

  useEffect(() => {
    if (!selectedDateKey) {
      setSelectedDeliverySlotId("");
      setSelectedDeliveryPeriod(null);
      return;
    }

    if (selectedDayPeriods.length === 0) {
      setSelectedDeliverySlotId("");
      setSelectedDeliveryPeriod(null);
      return;
    }

    const activePeriod = selectedDayPeriods.find(
      (period) => period.period === selectedDeliveryPeriod && period.available && period.slot,
    );
    const nextPeriod = activePeriod ?? selectedDayPeriods.find((period) => period.available && period.slot);

    if (!nextPeriod || !nextPeriod.slot) {
      setSelectedDeliveryPeriod(null);
      setSelectedDeliverySlotId("");
      return;
    }

    if (selectedDeliveryPeriod !== nextPeriod.period) {
      setSelectedDeliveryPeriod(nextPeriod.period);
    }

    if (selectedDeliverySlotId !== nextPeriod.slot.id) {
      setSelectedDeliverySlotId(nextPeriod.slot.id);
    }
  }, [selectedDateKey, selectedDayPeriods, selectedDeliveryPeriod, selectedDeliverySlotId]);

  const formatDeliverySlotLabel = (slot: DeliverySlotOption) => {
    const startAt = new Date(slot.startAt);
    const endAt = new Date(slot.endAt);
    const locale = language === "fr" ? "fr-CA" : "en-CA";

    const dateLabel = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(startAt);

    const startLabel = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(startAt);

    const endLabel = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(endAt);

    return `${dateLabel} \u00b7 ${startLabel} - ${endLabel}`;
  };

  const submitOrder = async () => {
    if (!user && paymentMethod !== "STRIPE") {
      setError(
        language === "fr"
          ? "Le paiement manuel nécessite un compte. Utilisez le paiement par carte en invité ou connectez-vous."
          : "Pay on delivery requires an account. Use guest card checkout or sign in.",
      );
      return;
    }
    if (!user && !guestCustomerName.trim()) {
      setError(language === "fr" ? "Entre ton nom complet pour commander en invité." : "Enter your full name to checkout as a guest.");
      return;
    }
    if (!user && !guestEmailValid) {
      setError(language === "fr" ? "Entre une adresse courriel valide pour commander en invité." : "Enter a valid email address to checkout as a guest.");
      return;
    }
    if (!cartRows.length) {
      setError(language === "fr" ? "Panier vide." : "Cart is empty.");
      return;
    }

    // Validation zone de livraison
    if (shippingPostal && !isRimouskiPostalCode(shippingPostal)) {
      setAddressError(
        language === "fr"
          ? "Désolé, nous livrons uniquement dans la région de Rimouski (ex: G5L, G5M, G5N, G0L, G0J). Vérifie ton code postal."
          : "Sorry, we only deliver in the Rimouski area (e.g. G5L, G5M, G5N, G0L, G0J). Please check your postal code.",
      );
      return;
    }

    if ((isDeliveryPhoneRequired && !hasDeliveryPhoneValue) || isDeliveryPhoneInvalid) {
      setDeliveryPhoneTouched(true);
      setAddressError(deliveryPhoneErrorMessage);
      return;
    }

    if (paymentMethod === "STRIPE" && quote && quote.totalCents < STRIPE_MINIMUM_TOTAL_CENTS) {
      setError(
        language === "fr"
          ? "Stripe exige un total d'au moins 0,50 $ CAD. Augmente légèrement le montant ou retire le rabais de test."
          : "Stripe requires a total of at least C$0.50. Increase the amount slightly or remove the test discount.",
      );
      return;
    }

    if (saveDeliveryAddress && !selectedSavedAddressId) {
      const duplicateAddress = deliveryAddresses.find((address) =>
        addressesMatch(address, {
          shippingLine1,
          shippingCity,
          shippingRegion,
          shippingPostal,
          shippingCountry,
        }),
      );

      if (duplicateAddress) {
        applyDeliveryAddress(duplicateAddress);
        setSaveDeliveryAddress(false);
        setAddressError(
          language === "fr"
            ? "Cette adresse est déjà enregistrée. Utilise l’adresse existante ou modifie-la dans ton compte."
            : "This address is already saved. Use the existing address or update it in your account.",
        );
        return;
      }
    }

    setLoading(true);
    setError("");
    setAddressError("");
    setMessage("");

    try {
      // Extraire les vraies dates de la fenêtre sélectionnée
      const selectedSlot = deliverySlots.find((s) => s.id === selectedDeliverySlotId);

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartRows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
          paymentMethod,
          customerName: user ? undefined : guestCustomerName.trim(),
          customerEmail: user ? undefined : guestCustomerEmail.trim().toLowerCase(),
          customerLanguage: language,
          promoCode: trimmedPromoCode || undefined,
          deliveryAddressId: selectedSavedAddressId || undefined,
          deliveryAddressLabel: saveDeliveryAddress ? deliveryAddressLabel.trim() || shippingLine1.trim() : undefined,
          saveDeliveryAddress: user ? saveDeliveryAddress : undefined,
          shippingLine1,
          shippingCity,
          shippingRegion,
          shippingPostal,
          shippingCountry,
          deliverySlotId: deliveryMode === "legacy" ? selectedSlot?.id || undefined : undefined,
          deliveryWindowStartAt:
            deliveryMode === "dynamic" ? selectedSlot?.startAt || undefined : undefined,
          deliveryWindowEndAt:
            deliveryMode === "dynamic" ? selectedSlot?.endAt || undefined : undefined,
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          deliveryPhone: deliveryPhone.trim() || undefined,
        }),
      });

      const json = (await res.json()) as Partial<OrderCheckoutResponse> & { error?: string };

      if (!res.ok) {
        if (json.error === "Adresse hors zone de livraison") {
          setAddressError(json.error);
          return;
        }

        if (json.error === "Cette adresse est déjà enregistrée. Utilise l’adresse existante ou modifie-la dans ton compte.") {
          setAddressError(json.error);
          return;
        }

        if (
          json.error === "Numéro de téléphone requis pour planifier la livraison" || json.error?.includes("Numéro de téléphone invalide") || json.error?.includes("Phone number must be 10 digits")
        ) {
          setDeliveryPhoneTouched(true);
          setAddressError(deliveryPhoneErrorMessage);
          return;
        }


        if (
          json.error === "Créneau de livraison introuvable" ||
          json.error === "Le créneau sélectionné est fermé" ||
          json.error === "Le créneau sélectionné est complet" ||
          json.error === "Le créneau est hors fenêtre de réservation"
        ) {
          setError(json.error);
          return;
        }

        if (json.error?.includes("0,50 $ CAD") || json.error?.includes("C$0.50")) {
          setError(json.error);
          return;
        }

        setError(json.error ?? (language === "fr" ? "Commande impossible." : "Could not place order."));
        return;
      }

      if (json.stripeCheckout) {
        setInlinePaymentMode("stripe");
        setPendingStripeConfirmation(json.confirmation ?? null);
        setStripeSession({
          ...json.stripeCheckout,
          fingerprint: checkoutFingerprint,
        });
        setStripeReturnNotice(null);
        setMessage("");
        return;
      }

      if (paymentMethod === "STRIPE") {
        setError(
          language === "fr"
            ? "Stripe est indisponible pour le moment. Essaie le paiement comptant ou vérifie la configuration."
            : "Stripe is currently unavailable. Try cash on delivery or verify configuration.",
        );
        return;
      }

      if (json.confirmation) {
        setInlineConfirmation(json.confirmation);
        setPendingStripeConfirmation(null);
        setInlinePaymentMode("manual");
        setStripeSession(null);
        setStripeReturnNotice(null);
      }

      setMessage(
        language === "fr"
          ? `Commande ${json.order?.orderNumber ?? ""} créée avec succès, paiement comptant à la livraison.`
          : `Order ${json.order?.orderNumber ?? ""} created successfully with cash on delivery.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStripeInlineSuccess = (session: { status: { type: "open" | "expired" | "complete"; paymentStatus?: "paid" | "unpaid" | "no_payment_required" } }) => {
    if (session.status.type === "complete" && pendingStripeConfirmation) {
      setInlineConfirmation(pendingStripeConfirmation);
      setPendingStripeConfirmation(null);
      setInlinePaymentMode("stripe");
      setStripeSession(null);
      setStripeReturnNotice("paid");
      setMessage("");
      return;
    }

    setStripeReturnNotice("pending");
    setMessage(
      language === "fr"
        ? "Le processeur de paiement a bien reçu la confirmation. La finalisation peut prendre quelques secondes."
        : "The payment processor received the confirmation. Final processing can take a few seconds.",
    );
  };

  if (inlineConfirmation) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">{t.brandName}</div>
          <Navigation language={language} t={t} user={user} />
        </header>

        <PromoBanner language={language} />

        <CheckoutSuccessView
          language={language}
          user={user}
          confirmation={inlineConfirmation}
          fallbackPaymentMode={inlinePaymentMode}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      {/* Page header */}
      <section className="section checkout-page-header">
        <div className="checkout-page-title-row">
          <span className="checkout-page-icon">{"\u{1F6D2}"}</span>
          <div>
            <h1 className="checkout-page-title">{t.checkoutTitle}</h1>
            <p className="checkout-page-subtitle">{t.checkoutSubtitle}</p>
          </div>
        </div>
        <div className="checkout-flow-strip" aria-label={language === "fr" ? "Étapes du checkout" : "Checkout steps"}>
          <span>{language === "fr" ? "Panier vérifié" : "Cart checked"}</span>
          <span>{language === "fr" ? "Adresse locale" : "Local address"}</span>
          <span>{language === "fr" ? "AM ou PM" : "AM or PM"}</span>
          <span>{language === "fr" ? "Paiement sécurisé" : "Secure payment"}</span>
        </div>
      </section>

      {cartRows.length === 0 ? (
        <section className="section cart-empty-state">
          <span className="cart-empty-icon">{"\u{1F43E}"}</span>
          <p className="cart-empty-text">
            {language === "fr" ? "Ton panier est vide. Rien à commander." : "Your cart is empty. Nothing to order."}
          </p>
          <Link className="btn" href="/">
            {language === "fr" ? "← Retour à la boutique" : "← Back to shop"}
          </Link>
        </section>
      ) : (
        <div className="checkout-grid">
          {/* Colonne principale */}
          <div className="checkout-main">

            {/* Récapitulatif du panier */}
            <section className="section checkout-section-card checkout-step-card checkout-step-card--summary">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">{"\u{1F4CB}"}</span>
                <h2 className="checkout-section-title">
                  {language === "fr" ? "Récapitulatif" : "Order summary"}
                </h2>
              </div>

              <div className="cart-table-wrap">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>{language === "fr" ? "Produit" : "Product"}</th>
                      <th className="cart-th-price">{language === "fr" ? "Prix unit." : "Unit price"}</th>
                      <th className="cart-th-qty">{language === "fr" ? "Qté" : "Qty"}</th>
                      <th className="cart-th-subtotal">{language === "fr" ? "Sous-total" : "Subtotal"}</th>
                      <th className="cart-th-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartRows.map((row) => (
                      <tr key={row.productId} className="cart-row">
                        <td className="cart-td-name">
                          <span className="cart-product-name">{row.name}</span>
                        </td>
                        <td className="cart-td-price">
                          <span className="cart-price-badge">{row.priceLabel}</span>
                        </td>
                        <td className="cart-td-qty">
                          <div className="cart-qty-control">
                            <button
                              className="cart-qty-btn"
                              type="button"
                              onClick={() => updateQty(row.productId, row.quantity - 1)}
                              aria-label={language === "fr" ? "Diminuer" : "Decrease"}
                            >
                              -
                            </button>
                            <input
                              className="cart-qty-input"
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => updateQty(row.productId, Math.max(1, Number(e.target.value) || 1))}
                            />
                            <button
                              className="cart-qty-btn"
                              type="button"
                              onClick={() => updateQty(row.productId, row.quantity + 1)}
                              aria-label={language === "fr" ? "Augmenter" : "Increase"}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="cart-td-subtotal">
                          <strong className="cart-subtotal-value">{row.lineSubtotalLabel}</strong>
                        </td>
                        <td className="cart-td-action">
                          <button
                            className="cart-remove-btn"
                            type="button"
                            onClick={() => remove(row.productId)}
                            aria-label={language === "fr" ? "Retirer" : "Remove"}
                            title={language === "fr" ? "Retirer" : "Remove"}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Adresse de livraison */}
            <section className="section checkout-section-card checkout-step-card checkout-step-card--address">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">{"\u{1F4CD}"}</span>
                <div>
                  <h2 className="checkout-section-title">
                    {language === "fr" ? "Adresse de livraison" : "Shipping address"}
                  </h2>
                  <p className="checkout-section-subtitle">
                    {language === "fr"
                      ? "Livraison locale à Rimouski seulement 📍"
                      : "Local delivery in Rimouski area only 📍"}
                  </p>
                </div>
              </div>

              {!user ? (
                <div
                  style={{
                    marginBottom: 18,
                    padding: "1rem 1.05rem",
                    borderRadius: "1.1rem",
                    border: "1px solid rgba(92, 107, 64, 0.16)",
                    background: "linear-gradient(180deg, rgba(248, 251, 242, 1) 0%, rgba(255, 253, 247, 0.96) 100%)",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <AddressGlyph />
                    <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                      <strong style={{ color: "#44321d" }}>
                        {language === "fr" ? "Commande en invité" : "Guest checkout"}
                      </strong>
                      <p className="small" style={{ margin: "6px 0 0", color: "#6f624d" }}>
                        {language === "fr"
                          ? "Tu peux commander sans compte avec Visa ou Mastercard. Le paiement manuel reste réservé aux clients connectés."
                          : "You can place your order without an account using Visa or Mastercard. Pay on delivery stays reserved for signed-in customers."}
                      </p>
                    </div>
                    <Link className="pill-link pill-link--sm" href="/login">
                      {language === "fr" ? "Se connecter" : "Sign in"}
                    </Link>
                  </div>

                  <div className="checkout-address-grid">
                    <div className="field">
                      <label>{language === "fr" ? "Nom complet" : "Full name"}</label>
                      <div className="input-icon-wrap">
                        <span className="input-icon">{"\u{1F464}"}</span>
                        <input
                          className="input input--icon"
                          placeholder={language === "fr" ? "Ex. Marie Tremblay" : "E.g. Marie Tremblay"}
                          value={guestCustomerName}
                          onChange={(e) => setGuestCustomerName(e.target.value)}
                          suppressHydrationWarning
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>{language === "fr" ? "Courriel" : "Email"}</label>
                      <div className="input-icon-wrap">
                        <span className="input-icon">{"\u{2709}"}</span>
                        <input
                          className={`input input--icon${guestCustomerEmail.trim() && !guestEmailValid ? " input--error" : ""}`}
                          placeholder="ton@email.com"
                          value={guestCustomerEmail}
                          onChange={(e) => setGuestCustomerEmail(e.target.value)}
                          inputMode="email"
                          autoComplete="email"
                          suppressHydrationWarning
                        />
                      </div>
                      <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                        {language === "fr"
                          ? "Le reçu et le suivi de paiement seront envoyés à cette adresse."
                          : "Your receipt and payment follow-up will be sent to this address."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {user ? (
                <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <strong>{language === "fr" ? "Mes adresses enregistrées" : "My saved addresses"}</strong>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        {language === "fr"
                          ? "Choisis une adresse existante ou passe explicitement en mode nouvelle adresse."
                          : "Choose an existing address or explicitly switch to new address mode."}
                      </p>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => startNewDeliveryAddress()}>
                      {language === "fr" ? "Ajouter une nouvelle adresse" : "Add a new address"}
                    </button>
                  </div>

                  {deliveryAddresses.length > 0 ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      {deliveryAddresses.map((address) => {
                        const active = selectedSavedAddressId === address.id;
                        const lines = formatAddressCardLines(address);
                        return (
                          <button
                            key={address.id}
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              textAlign: "left",
                              justifyContent: "stretch",
                              borderColor: active ? "rgba(123, 139, 90, 0.42)" : "rgba(197, 170, 109, 0.2)",
                              background: active ? "linear-gradient(180deg, rgba(248, 251, 242, 1) 0%, rgba(255, 253, 247, 1) 100%)" : "#fff",
                              boxShadow: active ? "0 12px 28px rgba(95, 72, 28, 0.08)" : "0 8px 22px rgba(95, 72, 28, 0.04)",
                              padding: "1.1rem 1.05rem",
                              display: "flex",
                              alignItems: "stretch",
                              gap: 16,
                              whiteSpace: "normal",
                              borderRadius: "1.1rem",
                            }}
                            onClick={() => applyDeliveryAddress(address)}
                          >
                            <div
                              style={{
                                flex: "1 1 320px",
                                minWidth: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                              }}
                            >
                              <AddressGlyph />
                              <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                                <div
                                  className="small"
                                  style={{
                                    marginTop: 0,
                                    marginBottom: 6,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    fontWeight: 700,
                                    color: "#8a7a59",
                                  }}
                                >
                                  {formatAddressCardTitle(address, user, language)}
                                </div>
                                <strong style={{ display: "block", fontSize: "1.14rem", lineHeight: 1.2, color: "#44321d" }}>
                                  {lines.main}
                                </strong>
                                <div
                                  style={{
                                    width: 44,
                                    height: 1,
                                    marginTop: 10,
                                    marginBottom: 10,
                                    background: "linear-gradient(90deg, rgba(197, 170, 109, 0.55) 0%, rgba(197, 170, 109, 0.08) 100%)",
                                  }}
                                />
                                <span className="small" style={{ display: "block", margin: 0, color: "#76664c" }}>{lines.secondary}</span>
                                <span className="small" style={{ display: "block", margin: "8px 0 0", color: "#6f624d" }}>
                                  {lines.country}{address.deliveryPhone ? ` • ${language === "fr" ? "Téléphone" : "Phone"}: ${address.deliveryPhone}` : ""}
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                flex: "0 0 196px",
                                minWidth: 176,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                justifyContent: "space-between",
                                gap: 12,
                                paddingLeft: 16,
                                borderLeft: "1px solid rgba(197, 170, 109, 0.18)",
                              }}
                            >
                              {address.lastUsedAt ? (
                                <span
                                  className="small"
                                  style={{
                                    margin: 0,
                                    padding: "0.36rem 0.72rem",
                                    borderRadius: "999px",
                                    border: "1px solid rgba(123, 139, 90, 0.35)",
                                    background: "rgba(123, 139, 90, 0.12)",
                                    color: "#55663b",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {language === "fr" ? "Dernière utilisation" : "Last used"}
                                </span>
                              ) : <span aria-hidden="true" style={{ height: 32 }} />}
                              <span
                                className="small"
                                style={{
                                  margin: 0,
                                  padding: active ? "0.42rem 0.72rem" : 0,
                                  borderRadius: active ? "999px" : 0,
                                  border: active ? "1px solid rgba(123, 139, 90, 0.28)" : "none",
                                  background: active ? "rgba(123, 139, 90, 0.1)" : "transparent",
                                  color: active ? "#55663b" : "#8a7a59",
                                  fontWeight: 700,
                                  textAlign: "right",
                                }}
                              >
                                {active
                                  ? (language === "fr" ? "Adresse sélectionnée" : "Selected")
                                  : (language === "fr" ? "Utiliser cette adresse" : "Use this address")}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="small" style={{ margin: 0 }}>
                      {language === "fr"
                        ? "Aucune adresse enregistrée pour le moment."
                        : "You do not have a saved address yet."}
                    </p>
                  )}
                  {user && isCreatingNewAddress ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "1rem 1.05rem",
                        borderRadius: "1.1rem",
                        border: "1px solid rgba(197, 170, 109, 0.2)",
                        background: "linear-gradient(180deg, rgba(255, 253, 247, 1) 0%, rgba(248, 251, 242, 0.92) 100%)",
                        boxShadow: "0 8px 20px rgba(95, 72, 28, 0.04)",
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <AddressGlyph />
                      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                        <strong style={{ color: "#44321d" }}>{language === "fr" ? "Mode nouvelle adresse" : "New address mode"}</strong>
                        <p className="small" style={{ marginTop: 6, marginBottom: 0, color: "#6f624d" }}>
                          {language === "fr"
                            ? "Cette nouvelle adresse sera comparée à ton carnet pour éviter les doublons."
                            : "This new address will be compared with your address book to avoid duplicates."}
                        </p>
                      </div>
                      <span
                        className="small"
                        style={{
                          margin: 0,
                          padding: "0.38rem 0.72rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(197, 170, 109, 0.24)",
                          background: "rgba(197, 170, 109, 0.12)",
                          color: "#7b6a48",
                          fontWeight: 700,
                        }}
                      >
                        {language === "fr" ? "Nouvelle saisie" : "New entry"}
                      </span>
                    </div>
                  ) : null}
                  {user ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "1rem 1.05rem",
                        borderRadius: "1.1rem",
                        border: "1px solid rgba(197, 170, 109, 0.16)",
                        background: "rgba(255, 252, 246, 0.86)",
                      }}
                    >
                      <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600, color: "#44321d" }}>
                        <input
                          type="checkbox"
                          checked={saveDeliveryAddress}
                          onChange={(event) => setSaveDeliveryAddress(event.target.checked)}
                        />
                        <span>
                          {language === "fr"
                            ? "Enregistrer dans mon carnet d’adresses"
                            : "Save to my address book"}
                        </span>
                      </label>
                      <p className="small" style={{ marginTop: 8, marginBottom: 0, color: "#6f624d" }}>
                        {language === "fr"
                          ? "Si elle est déjà enregistrée, on utilisera simplement l’adresse existante."
                          : "If it is already saved, we will simply use the existing address."}
                      </p>
                      {isCreatingNewAddress && saveDeliveryAddress ? (
                        <p className="small" style={{ marginTop: 8, marginBottom: 0, color: "#7b6a48" }}>
                          {language === "fr"
                            ? "Nouvelle adresse: l’enregistrement est activé par défaut. Tu peux le décocher si tu veux seulement l’utiliser pour cette commande."
                            : "New address: saving is enabled by default. Uncheck it if you only want to use it for this order."}
                        </p>
                      ) : null}
                      {deliveryAddresses.length === 0 ? (
                        <p className="small" style={{ marginTop: 8, marginBottom: 0, color: "#7b6a48" }}>
                          {language === "fr"
                          ? "Première adresse: l'enregistrement est coché par défaut."
                          : "First address: saving is checked by default."}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {(!user || isCreatingNewAddress || deliveryAddresses.length === 0) ? (
              <div className="checkout-address-grid">
                <div className="field checkout-field-full">
                  <label>{language === "fr" ? "Adresse civique" : "Street address"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F3E0}"}</span>
                    <input
                      className="input input--icon"
                      placeholder={language === "fr" ? "Ex. 123 rue des Oliviers" : "E.g. 123 Olive Street"}
                      value={shippingLine1}
                      onChange={(e) => setShippingLine1(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                  <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                    {language === "fr"
                      ? "Entre le numéro civique et le nom de rue comme sur ton adresse postale."
                      : "Enter the civic number and street name as shown on your mailing address."}
                  </p>
                </div>
                <div className="field">
                  <label>{language === "fr" ? "Ville" : "City"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F3D8}"}</span>
                    <input
                      className="input input--icon"
                      placeholder="Rimouski"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                <div className="field">
                  <label>{language === "fr" ? "Province" : "Province"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F3D9}"}</span>
                    <select
                      className="input input--icon"
                      value={shippingRegion}
                      onChange={(e) => setShippingRegion(normalizeProvinceCode(e.target.value))}
                      suppressHydrationWarning
                    >
                      {CANADIAN_PROVINCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getAddressOptionLabel(option, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>
                    {language === "fr" ? "Code postal" : "Postal code"}
                    {postalTouched && (
                      <span className={`checkout-postal-badge${postalValid ? " checkout-postal-badge--ok" : " checkout-postal-badge--err"}`}>
                        {postalValid
                          ? (language === "fr" ? "✓ Zone couverte" : "✓ Zone covered")
                          : (language === "fr" ? "❌ Hors zone" : "❌ Out of zone")}
                      </span>
                    )}
                  </label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F4CD}"}</span>
                    <input
                      className={`input input--icon${postalTouched && !postalValid ? " input--error" : ""}`}
                      placeholder={language === "fr" ? "Ex. G5L1A1" : "E.g. G5L1A1"}
                      value={shippingPostal}
                      onChange={(e) => setShippingPostal(normalizePostalCodeInput(e.target.value))}
                      suppressHydrationWarning
                    />
                  </div>
                  {postalTouched && !postalValid && (
                    <p className="checkout-postal-hint">
                      {language === "fr"
                        ? "Codes acceptés : G5L, G5M, G5N, G5J, G5K, G5H, G0L, G5X, G0J et alentours."
                        : "Accepted codes: G5L, G5M, G5N, G5J, G5K, G5H, G0L, G5X, G0J and surroundings."}
                    </p>
                  )}
                  <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                    {language === "fr"
                      ? "Seules les adresses de livraison locales dans notre zone sont acceptées."
                      : "Only local delivery addresses inside our service area are accepted."}
                  </p>
                  {addressError && (
                    <p className="checkout-postal-hint" style={{ color: "#dc2626" }}>
                    ⚠️ {addressError}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label>{language === "fr" ? "Pays" : "Country"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F310}"}</span>
                    <select
                      className="input input--icon"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(normalizeCountryCode(e.target.value))}
                      suppressHydrationWarning
                    >
                      {COUNTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getAddressOptionLabel(option, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              ) : (
                <div
                  style={{
                    padding: "1rem 1.1rem",
                    borderRadius: "1.1rem",
                    border: "1px solid rgba(197, 170, 109, 0.2)",
                    background: "linear-gradient(180deg, rgba(255, 253, 247, 1) 0%, rgba(252, 250, 247, 0.94) 100%)",
                    boxShadow: "0 8px 20px rgba(95, 72, 28, 0.04)",
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <AddressGlyph />
                  <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                    <div
                      className="small"
                      style={{
                        marginTop: 0,
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                        color: "#8a7a59",
                      }}
                    >
                      {language === "fr" ? "Adresse sélectionnée" : "Selected address"}
                    </div>
                    <strong style={{ display: "block", color: "#44321d" }}>
                      {selectedSavedAddress?.shippingLine1 ?? shippingLine1}
                    </strong>
                    <p className="small" style={{ marginTop: 6, marginBottom: 0, color: "#6f624d" }}>
                      {selectedSavedAddress
                        ? `${selectedSavedAddress.shippingCity}, ${selectedSavedAddress.shippingRegion}, ${selectedSavedAddress.shippingPostal}, ${selectedSavedAddress.shippingCountry}`
                        : language === "fr"
                          ? "Tu utilises une adresse enregistrée. Clique sur « Ajouter une nouvelle adresse » si tu veux en saisir une autre."
                          : "You are using a saved address. Click “Add a new address” if you want to enter another one."}
                    </p>
                    {selectedSavedAddress?.deliveryPhone ? (
                      <p className="small" style={{ marginTop: 8, marginBottom: 0, color: "#7b6a48" }}>
                        {language === "fr" ? "Téléphone" : "Phone"}: {selectedSavedAddress.deliveryPhone}
                      </p>
                    ) : null}
                    {addressError ? (
                      <p className="checkout-postal-hint" style={{ color: "#dc2626", marginTop: 8 }}>
                        ⚠️ {addressError}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="small"
                    style={{
                      margin: 0,
                      padding: "0.4rem 0.75rem",
                      borderRadius: "999px",
                      border: "1px solid rgba(123, 139, 90, 0.28)",
                      background: "rgba(123, 139, 90, 0.1)",
                      color: "#55663b",
                      fontWeight: 700,
                    }}
                  >
                    {language === "fr" ? "Adresse active" : "Active address"}
                  </span>
                </div>
              )}
            </section>

            {/* Créneau et consignes de livraison */}
            <section className="section checkout-section-card checkout-step-card checkout-step-card--delivery">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">{"\u{23F0}"}</span>
                <div>
                  <h2 className="checkout-section-title">
                    {language === "fr" ? "Période de livraison" : "Delivery period"}
                  </h2>
                  <p className="checkout-section-subtitle">
                    {language === "fr"
                      ? "Choisis la période qui te convient le mieux."
                      : "Choose the delivery period that works best for you."}
                  </p>
                </div>
              </div>

              <div className="checkout-delivery-intro">
                <div className="checkout-delivery-stepper">
                  <div className={`checkout-delivery-step${shippingPostal.trim() ? " checkout-delivery-step--done" : ""}`}>
                    <span className="checkout-delivery-step-index">1</span>
                    <span>{language === "fr" ? "Zone de livraison" : "Delivery area"}</span>
                  </div>
                  <div className={`checkout-delivery-step${selectedDateKey ? " checkout-delivery-step--done" : ""}`}>
                    <span className="checkout-delivery-step-index">2</span>
                    <span>{language === "fr" ? "Jour" : "Day"}</span>
                  </div>
                  <div className={`checkout-delivery-step${selectedDeliveryPeriod ? " checkout-delivery-step--done" : ""}`}>
                  <span className="checkout-delivery-step-index">3</span>
                    <span>{language === "fr" ? "Période" : "Period"}</span>
                  </div>
                </div>
                <div className="checkout-delivery-banner">
                <strong>{language === "fr" ? "Livraison locale à Rimouski et environs" : "Local delivery in Rimouski and nearby"}</strong>
                  <span>{deliveryStepLabel}</span>
                </div>
              </div>

              {!shippingPostal.trim() ? (
                <p className="small checkout-delivery-feedback" style={{ marginTop: 0 }}>
                  {language === "fr"
                    ? "Entre d'abord ton code postal pour voir les périodes disponibles."
                    : "Enter your postal code first to view available delivery periods."}
                </p>
              ) : !postalValid ? (
                <p className="checkout-postal-hint checkout-delivery-feedback" style={{ marginTop: 0 }}>
                  {language === "fr"
                    ? "Aucune période affichée tant que le code postal est hors zone de livraison."
                    : "No delivery periods are shown while the postal code is outside the delivery area."}
                </p>
              ) : deliverySlotsLoading ? (
                <p className="small checkout-delivery-feedback" style={{ marginTop: 0 }}>
                  {language === "fr" ? "Chargement des périodes..." : "Loading delivery periods..."}
                </p>
              ) : (
                <>
                  {deliverySlotsError ? (
                    <p className="checkout-postal-hint checkout-delivery-feedback" style={{ marginTop: 0 }}>
                      ⚠️ {deliverySlotsError}
                    </p>
                  ) : null}

                  {deliverySlots.length === 0 ? (
                    <div className="checkout-delivery-feedback" style={{ marginTop: 0 }}>
                      <p className="small" style={{ margin: 0, fontWeight: 700 }}>
                        {language === "fr" ? "Planification manuelle activée" : "Manual scheduling enabled"}
                      </p>
                      <p className="small" style={{ margin: "6px 0 0" }}>
                        {language === "fr"
                          ? "Aucune période n'est disponible pour l'instant. Tu peux finaliser la commande quand même et notre équipe t'appellera pour convenir d'une plage de livraison."
                          : "No delivery periods are available right now. You can still complete your order and our team will call you to arrange a delivery window."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="checkout-delivery-calendar">
                        <div className="checkout-delivery-calendar-head">
                          {(language === "fr"
                            ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
                            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]).map((weekday) => (
                            <span key={weekday}>{weekday}</span>
                          ))}
                        </div>
                        <div className="checkout-delivery-calendar-grid">
                          {calendarDays.map((day) => {
                            const isActive = selectedDateKey === day.dateKey;
                            const label = new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
                              day: "numeric",
                              month: "short",
                            }).format(day.date);

                            if (!day.availableDay) {
                              return (
                                <div key={day.dateKey} className="checkout-delivery-calendar-cell checkout-delivery-calendar-cell--empty">
                                  <span>{label}</span>
                                </div>
                              );
                            }

                            const availableDay = day.availableDay;
                            const tone = availableDay.tone;

                            return (
                              <button
                                key={day.dateKey}
                                type="button"
                                onClick={() => setSelectedDateKey(isActive ? null : day.dateKey)}
                                className={`checkout-delivery-calendar-cell checkout-delivery-calendar-cell--${tone}${isActive ? " checkout-delivery-calendar-cell--active" : ""}`}
                              >
                                <strong>{day.date.getDate()}</strong>
                                <span>{label}</span>
                                <small>{formatPeriodCount(availableDay.periodCount, language)}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {selectedDateKey ? (
                        <>
                          <div className="checkout-delivery-slot-heading">
                            <strong>
                              {language === "fr" ? "Choisis ta période" : "Choose your period"}
                            </strong>
                            <span>
                              {language === "fr"
                                ? `Jour choisi: ${formatDeliveryDayLabel(selectedDateKey, language)}`
                                : `Chosen day: ${formatDeliveryDayLabel(selectedDateKey, language)}`}
                            </span>
                          </div>
                          <div className="checkout-delivery-periods">
                                {selectedDayPeriods.map((periodOption) => {
                                  const active = selectedDeliveryPeriod === periodOption.period;
                              return (
                                <label
                                  key={periodOption.period}
                                  className={`checkout-delivery-period-card checkout-delivery-period-card--${periodOption.tone}${active ? " checkout-delivery-period-card--active" : ""}${!periodOption.available ? " checkout-delivery-period-card--disabled" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name="deliveryPeriod"
                                    value={periodOption.period}
                                    checked={active}
                                    disabled={!periodOption.available || !periodOption.slot}
                                    onChange={() => {
                                      if (!periodOption.slot) return;
                                      setSelectedDeliveryPeriod(periodOption.period);
                                      setSelectedDeliverySlotId(periodOption.slot.id);
                                    }}
                                    className="checkout-payment-radio"
                                  />
                                  <div className="checkout-delivery-period-title">{periodOption.label}</div>
                                  <div className="checkout-delivery-period-status">{periodOption.statusText}</div>
                                  <div className="checkout-delivery-period-note">
                                    {periodOption.slot
                                      ? language === "fr"
                                        ? `Livraison en ${periodOption.label}`
                                        : `Delivery in ${periodOption.label}`
                              : language === "fr"
                                ? "Aucune place dans cette période."
                                : "No space in this period."}
                                  </div>
                                  {active ? <span className="checkout-payment-check">✓</span> : null}
                                </label>
                              );
                            })}
                          </div>
                        </>
                      ) : null}

                      <div className="checkout-delivery-summary">
                        <div className="checkout-delivery-summary-card">
                          <span className="checkout-delivery-summary-label">
                            {language === "fr" ? "Période retenue" : "Selected period"}
                          </span>
                          {selectedSlot ? (
                            <>
                              <strong>
                                {formatDeliveryDayLabel(selectedSlot.dateKey, language)} - {formatDeliveryPeriodLabel(getDeliveryPeriod(selectedSlot), language)}
                              </strong>
                              <span>
                                {language === "fr"
                                  ? "Notre équipe placera la tournée dans cette période."
                                  : "Our team will place the route inside this period."}
                              </span>
                            </>
                          ) : (
                            <span>
                              {language === "fr"
                                ? "Aucune période choisie pour le moment."
                                : "No delivery period selected yet."}
                            </span>
                          )}
                        </div>
                        <div className="checkout-delivery-summary-card">
                          <span className="checkout-delivery-summary-label">
                            {language === "fr" ? "Bon à savoir" : "Good to know"}
                          </span>
                          <ul className="checkout-delivery-benefits">
                            <li>{language === "fr" ? "Livraison locale uniquement, selon le code postal." : "Local delivery only, based on your postal code."}</li>
                            <li>{language === "fr" ? "Le téléphone aide le livreur si besoin." : "A phone number helps the driver if needed."}</li>
                            <li>{language === "fr" ? "S'il n'y a plus de place, nous te contacterons." : "If no slots remain, we will contact you directly."}</li>
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="checkout-address-grid" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>{language === "fr" ? "Téléphone pour la livraison" : "Delivery phone"}</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">{"\u{1F4F1}"}</span>
                    <input
                      className={`input input--icon${showDeliveryPhoneError && deliveryPhoneTouched ? " input--error" : ""}`}
                      placeholder={language === "fr" ? "418 555-1234" : "418 555-1234"}
                      inputMode="tel"
                      value={deliveryPhone}
                      onChange={(e) => {
                        const digits = normalizeDeliveryPhone(e.target.value).slice(0, 11);
                        setDeliveryPhone(digits);
                        setDeliveryPhoneTouched(isDeliveryPhoneRequired);
                      }}
                      onBlur={() => setDeliveryPhoneTouched(true)}
                      suppressHydrationWarning
                    />
                  </div>
                  {showDeliveryPhoneError && deliveryPhoneTouched && (
                    <p className="checkout-postal-hint" style={{ color: "#dc2626" }}>
                      ⚠️ {deliveryPhoneErrorMessage}
                    </p>
                  )}
                  {!showDeliveryPhoneError || !deliveryPhoneTouched ? (
                    <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                      {language === "fr"
                        ? "Ex. 418 555-1234. Ce numéro aide le livreur si on doit te joindre."
                        : "E.g. 418 555-1234. This helps the driver reach you if needed."}
                    </p>
                  ) : null}
                </div>

                <div className="field checkout-field-full">
                  <label>{language === "fr" ? "Instructions de livraison" : "Delivery instructions"}</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={500}
                    placeholder={language === "fr"
                      ? "Ex.: laisser \u00E0 la porte, sonner \u00E0 l'arriv\u00E9e, code d'acc\u00E8s..."
                      : "E.g. leave at the door, ring on arrival, access code..."}
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                  />
                </div>

                {user && saveDeliveryAddress && isCreatingNewAddress ? (
                  <div className="field checkout-field-full">
                    <label>{language === "fr" ? "Nom de l'adresse (optionnel)" : "Address label (optional)"}</label>
                    <input
                      className="input"
                      placeholder={language === "fr" ? "Ex. Maison, Travail" : "E.g. Home, Work"}
                      value={deliveryAddressLabel}
                      onChange={(e) => setDeliveryAddressLabel(e.target.value)}
                    />
                    <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
                      {language === "fr"
                        ? "Si tu le laisses vide, on utilisera automatiquement l’adresse civique."
                        : "If left empty, we will use the street address automatically."}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

              {/* Méthode de paiement */}
            <section className="section checkout-section-card checkout-step-card checkout-step-card--payment">
              <div className="checkout-section-header">
                <span className="checkout-section-icon">{"\u{1F4B3}"}</span>
                <div>
                  <h2 className="checkout-section-title">
                    {language === "fr" ? "Méthode de paiement" : "Payment method"}
                  </h2>
                  <p className="checkout-section-subtitle">
                    {language === "fr" ? "Choisis comment tu veux payer." : "Choose how you'd like to pay."}
                  </p>
                </div>
              </div>

              <div className="checkout-payment-methods">
                <label
                  className={`checkout-payment-option${paymentMethod === "MANUAL" ? " checkout-payment-option--active" : ""}${!user ? " checkout-payment-option--disabled" : ""}`}
                  style={!user ? { opacity: 0.58, cursor: "not-allowed" } : undefined}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MANUAL"
                    checked={paymentMethod === "MANUAL"}
                    onChange={() => {
                      if (!user) return;
                      setPaymentMethod("MANUAL");
                    }}
                    disabled={!user}
                    className="checkout-payment-radio"
                  />
                  <span className="checkout-payment-option-icon">{"\u{1F4B3}"}</span>
                  <div className="checkout-payment-option-text">
                    <span className="checkout-payment-option-label">{t.manualPayment}</span>
                    <span className="checkout-payment-option-desc">
                      {language === "fr"
                        ? user
                          ? "Paiement comptant au moment de la livraison. Livraison locale uniquement (région de Rimouski)."
                          : "Connexion requise pour utiliser le paiement manuel et faciliter le suivi de la commande."
                        : user
                          ? "Cash payment at the time of delivery. Local delivery only (Rimouski area)."
                          : "Sign in is required to use manual payment and keep delivery follow-up clear."}
                    </span>
                  </div>
                  {paymentMethod === "MANUAL" && <span className="checkout-payment-check">✓</span>}
                </label>

                <label className={`checkout-payment-option${paymentMethod === "STRIPE" ? " checkout-payment-option--active" : ""}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="STRIPE"
                    checked={paymentMethod === "STRIPE"}
                    onChange={() => setPaymentMethod("STRIPE")}
                    className="checkout-payment-radio"
                  />
                  <span className="checkout-payment-option-icon">{"\u{26A1}"}</span>
                  <div className="checkout-payment-option-text">
                    <span className="checkout-payment-option-label">{t.stripePayment}</span>
                    <span className="checkout-payment-option-desc">
                      {language === "fr"
                        ? "Paiement sécurisé par carte. La confirmation reste dans cette page, sauf si la banque exige une vérification."
                        : "Secure card payment. Confirmation stays on this page unless the bank requires verification."}
                    </span>
                  </div>
                  {paymentMethod === "STRIPE" && <span className="checkout-payment-check">✓</span>}
                </label>
              </div>

              {!user ? (
                <p className="small" style={{ marginTop: 10, marginBottom: 0, color: "#6f624d" }}>
                  {language === "fr"
                    ? "En invité, le paiement par carte est l’option recommandée. Ton paiement est confirmé immédiatement et ton courriel sert au reçu."
                    : "As a guest, card payment is the recommended option. Your payment is confirmed immediately and your email is used for the receipt."}
                </p>
              ) : null}

              {paymentMethod === "STRIPE" ? (
                <p className="small" style={{ marginTop: 12, marginBottom: 0, color: "#6f624d" }}>
                  {stripeSession
                    ? language === "fr"
                      ? "Le formulaire de paiement est maintenant ancré dans le résumé de commande à droite pour une validation plus simple."
                      : "The payment form is now anchored in the order summary on the right for a cleaner confirmation flow."
                    : language === "fr"
                      ? "Quand tu prépares le paiement, le formulaire par carte s'ouvre directement dans le résumé de commande."
                      : "When you prepare payment, the card form opens directly inside the order summary."}
                </p>
              ) : null}
            </section>

          </div>

          {/* Colonne résumé */}
          <div className="checkout-sidebar">
            <div className="checkout-summary-card">
              <div className="checkout-summary-title">
                {language === "fr" ? "Résumé de la commande" : "Order total"}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>{language === "fr" ? "Code promo" : "Promo code"}</label>
                <input
                  className="input"
                  placeholder={language === "fr" ? "Ex. OLIVE10" : "e.g. OLIVE10"}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
                {trimmedPromoCode && (
                  <p className={promoApplied ? "ok" : "small"}>
                      {promoApplied
                      ? (language === "fr" ? "✓ Le rabais de 10% est appliqué." : "✓ Your 10% discount is applied.")
                      : (language === "fr" ? "Le code sera vérifié automatiquement au calcul." : "The code will be checked automatically during pricing.")}
                  </p>
                )}
              </div>

              <div className="checkout-summary-lines">
                {cartRows.map((row) => (
                  <div key={row.productId} className="checkout-summary-line">
                    <span className="checkout-summary-line-name">
                      {row.name} <span className="checkout-summary-line-qty">{"\u00d7"}{row.quantity}</span>
                    </span>
                    <span className="checkout-summary-line-price">{row.lineSubtotalLabel}</span>
                  </div>
                ))}
              </div>

              <div className="checkout-summary-divider" />

              <div className="checkout-summary-row">
                <span>{language === "fr" ? "Sous-total" : "Subtotal"}</span>
                <span>{quote ? formatCad(quote.subtotalCents, language) : subtotalLabel}</span>
              </div>
              {quote && quote.discountCents > 0 && (
                <div className="checkout-summary-row">
                  <span>{language === "fr" ? "Rabais promo" : "Promo discount"}</span>
                  <span>-{formatCad(quote.discountCents, language)}</span>
                </div>
              )}
              <div className="checkout-summary-row checkout-summary-row--shipping">
                <span>{language === "fr" ? "Livraison" : "Shipping"}</span>
                <span className="checkout-summary-free">
                  {quote
                    ? formatCad(quote.shippingCents, language)
                    : language === "fr"
                      ? "Calcul..."
                      : "Calculating..."}
                </span>
              </div>
              <div className="checkout-summary-divider" />
              <div className="checkout-summary-row">
                <span>{language === "fr" ? "Total avant taxes" : "Total before taxes"}</span>
                <span>{quote ? formatCad(beforeTaxCents, language) : subtotalLabel}</span>
              </div>
                <div className="checkout-summary-row">
                  <span>{language === "fr" ? "TPS (5%)" : "GST (5%)"}</span>
                <span>{quote ? formatCad(quote.gstCents, language) : language === "fr" ? "Calcul..." : "Calculating..."}</span>
                </div>
                <div className="checkout-summary-row">
                  <span>{language === "fr" ? "TVQ (9,975%)" : "QST (9.975%)"}</span>
                <span>{quote ? formatCad(quote.qstCents, language) : language === "fr" ? "Calcul..." : "Calculating..."}</span>
                </div>
                <div className="checkout-summary-row">
                  <span>{language === "fr" ? "Taxes totales" : "Total taxes"}</span>
                <span>{quote ? formatCad(quote.gstCents + quote.qstCents, language) : language === "fr" ? "Calcul..." : "Calculating..."}</span>
                </div>

              <div className="checkout-summary-divider" />

              <div className="checkout-summary-total-row">
                <span>{language === "fr" ? "Total" : "Total"}</span>
                <span className="checkout-summary-total-amount">
                  {quote ? formatCad(quote.totalCents, language) : subtotalLabel}
                </span>
              </div>

                {/* Info zone livraison */}
                <div className="checkout-zone-note">
                  📍 {language === "fr"
                    ? "Livraison locale à Rimouski et environs seulement."
                    : "Local delivery in Rimouski area only."}
                </div>

                {message ? (
                  <div className="auth-alert auth-alert--ok">
                  <span>✓</span> {message}
                  </div>
                ) : null}
                {error ? (
                  <div className="auth-alert auth-alert--err">
                  <span>⚠️</span> {error}
                  </div>
                ) : null}

              {stripeReturnNotice === "paid" ? (
                <div className="auth-alert auth-alert--ok">
                  <span>✓</span>{" "}
                  {language === "fr"
                    ? "Paiement par carte confirmé. Le reçu et la commande ont été validés."
                    : "Card payment confirmed. Your receipt and order were validated."}
                </div>
              ) : null}

              {stripeReturnNotice === "pending" ? (
                <div className="auth-alert">
                  <span>…</span>{" "}
                  {language === "fr"
                    ? "Le processeur de paiement a bien reçu le retour. La confirmation finale peut prendre quelques secondes."
                    : "The payment processor received the return. Final confirmation can take a few seconds."}
                </div>
              ) : null}

              {paymentMethod === "STRIPE" && stripeSession ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="auth-alert auth-alert--ok" style={{ marginTop: 0 }}>
                    <span>✓</span>{" "}
                    {language === "fr"
                      ? "Ton paiement est prêt ici. Vérifie la carte ci-dessous et confirme-la sans quitter la page."
                      : "Your payment is ready here. Review the card below and confirm it without leaving the page."}
                  </div>

                  <StripeInlineCheckout
                    clientSecret={stripeSession.clientSecret}
                    returnUrl={stripeSession.returnUrl}
                    submitLabel={language === "fr" ? "Confirmer le paiement par carte" : "Confirm card payment"}
                    loadingLabel={language === "fr" ? "Confirmation..." : "Confirming..."}
                    headline={language === "fr" ? "Confirme ton paiement ici" : "Confirm your payment here"}
                    description={
                      language === "fr"
                        ? "Ton panier est réservé pour cette tentative. Si la banque exige une vérification externe, tu reviendras automatiquement sur cette page."
                        : "Your cart is reserved for this attempt. If the bank requires an external verification, you will return to this page automatically."
                    }
                    errorMessage={error || undefined}
                    language={language}
                    variant="summary"
                    defaults={{
                      name: user ? `${user.firstName} ${user.lastName}`.trim() : guestCustomerName.trim(),
                      line1: shippingLine1.trim(),
                      city: shippingCity.trim(),
                      region: shippingRegion.trim(),
                      postalCode: shippingPostal.trim(),
                      country: shippingCountry.trim(),
                    }}
                    onSuccess={handleStripeInlineSuccess}
                    onError={(message) => {
                      setError(message);
                      setMessage("");
                    }}
                  />
                </div>
              ) : (
                <button
                  className="btn btn-full checkout-place-order-btn"
                  disabled={loading}
                  onClick={() => void submitOrder()}
                  type="button"
                  suppressHydrationWarning
                >
                  {loading ? (
                    <span className="checkout-spinner">⟳</span>
                  ) : (
                    <>
                      {paymentMethod === "STRIPE"
                        ? language === "fr"
                          ? "Préparer le paiement"
                          : "Prepare payment"
                        : t.placeOrder}{" "}
                      {"\u2192"} {quote ? formatCad(quote.totalCents, language) : subtotalLabel}
                    </>
                  )}
                </button>
              )}

              <Link className="checkout-back-link" href="/cart">
                {language === "fr" ? "← Retour au panier" : "← Back to cart"}
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




