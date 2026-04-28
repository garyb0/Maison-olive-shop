import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import {
  getActiveDeliveryDriverCount,
  getAdminDeliverySlots,
  getDeliveryScheduleSettings,
  toDateKey,
} from "@/lib/delivery";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { AdminDeliveryClient } from "./admin-delivery-client";

type AdminDeliverySlots = Awaited<ReturnType<typeof getAdminDeliverySlots>>;
type AdminDeliverySlot = AdminDeliverySlots[number];

export default async function AdminDeliveryPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  const [slots, scheduleSettings, activeDriverCount] = await Promise.all([
    getAdminDeliverySlots(),
    getDeliveryScheduleSettings(),
    getActiveDeliveryDriverCount(),
  ]);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayOrders = await prisma.order.findMany({
    where: {
      deliveryWindowStartAt: { gte: todayStart, lte: todayEnd },
      status: { not: "CANCELLED" },
      paymentStatus: { not: "FAILED" },
    },
    orderBy: [{ deliveryWindowStartAt: "asc" }, { shippingPostal: "asc" }, { shippingLine1: "asc" }],
  });

  const todayDeliveries = todayOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName ?? "-",
    customerEmail: order.customerEmail ?? "-",
    deliveryStatus: order.deliveryStatus,
    deliveryPhone: order.deliveryPhone,
    deliveryInstructions: order.deliveryInstructions,
    shippingLine1: order.shippingLine1,
    shippingCity: order.shippingCity,
    shippingPostal: order.shippingPostal,
    deliverySlotId: order.deliverySlotId,
    deliveryWindowStartAt: order.deliveryWindowStartAt?.toISOString() ?? null,
    deliveryWindowEndAt: order.deliveryWindowEndAt?.toISOString() ?? null,
    dateKey: order.deliveryWindowStartAt ? toDateKey(order.deliveryWindowStartAt) : null,
    windowLabel:
      order.deliveryWindowStartAt && order.deliveryWindowEndAt
        ? `${formatDate(order.deliveryWindowStartAt, locale)} -> ${formatDate(order.deliveryWindowEndAt, locale)}`
        : "-",
  }));

  return (
    <AdminDeliveryClient
      language={language}
      initialSlots={slots.map((slot: AdminDeliverySlot) => ({
        id: slot.id,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        periodKey: slot.periodKey,
        periodLabel: slot.periodLabel,
        isOpen: slot.isOpen,
        note: slot.note,
        dateKey: slot.dateKey,
        capacity: slot.capacity,
        reservedCount: slot.reservedCount,
        remainingCapacity: slot.remainingCapacity,
        exception: slot.exception,
      }))}
      initialSettings={scheduleSettings}
      initialActiveDriverCount={activeDriverCount}
      todayDeliveries={todayDeliveries}
    />
  );
}
