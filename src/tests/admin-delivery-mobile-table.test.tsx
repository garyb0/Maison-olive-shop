import { render, within } from "@testing-library/react";
import { AdminDeliveryClient } from "@/app/admin/delivery/admin-delivery-client";
import type { DeliveryScheduleSettings } from "@/lib/types";

const scheduleSettings: DeliveryScheduleSettings = {
  id: "settings_1",
  averageDeliveryMinutes: 30,
  blockMinutes: 120,
  amEnabled: true,
  amStartMinute: 540,
  amEndMinute: 720,
  pmEnabled: true,
  pmStartMinute: 780,
  pmEndMinute: 1020,
  capacityMode: "ACTIVE_DRIVERS",
  createdAt: null,
  updatedAt: null,
};

describe("AdminDeliveryClient mobile table labels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expose des labels mobiles pour la route du jour et les creneaux planifies", () => {
    const { container } = render(
      <AdminDeliveryClient
        language="fr"
        initialSettings={scheduleSettings}
        initialActiveDriverCount={1}
        todayDeliveries={[
          {
            id: "order_1",
            orderNumber: "MO-20260428-0001",
            customerName: "Client Invite",
            customerEmail: "client@example.com",
            deliveryStatus: "SCHEDULED",
            deliveryPhone: "4185551212",
            deliveryInstructions: "Laisser a la porte",
            shippingLine1: "22 rue Principale",
            shippingCity: "Rimouski",
            shippingPostal: "G5L 1A1",
            deliverySlotId: "slot_1",
            deliveryWindowStartAt: "2099-05-01T13:00:00.000Z",
            deliveryWindowEndAt: "2099-05-01T14:00:00.000Z",
            dateKey: "2099-05-01",
            windowLabel: "AM",
          },
        ]}
        initialSlots={[
          {
            id: "slot_1",
            startAt: "2099-05-01T13:00:00.000Z",
            endAt: "2099-05-01T14:00:00.000Z",
            periodKey: "AM",
            periodLabel: "AM",
            isOpen: true,
            note: null,
            dateKey: "2099-05-01",
            capacity: 4,
            reservedCount: 1,
            remainingCapacity: 3,
            exception: null,
          },
        ]}
      />,
    );

    expect(container.querySelectorAll(".admin-mobile-table-wrap")).toHaveLength(2);
    expect(container.querySelectorAll(".admin-mobile-table")).toHaveLength(2);
    expect(container.querySelector('td[data-label="Commande"]')).toHaveTextContent("MO-20260428-0001");
    expect(container.querySelector('td[data-label="Adresse"]')).toHaveTextContent("22 rue Principale");

    const slotCapacityCell = container.querySelector('td[data-label="Capacité"]');
    expect(slotCapacityCell).not.toBeNull();
    expect(within(slotCapacityCell as HTMLElement).getByText("4")).toBeInTheDocument();
    expect(container.querySelector('td[data-label="Réservé"]')).not.toBeNull();
    expect(container.querySelector('td[data-label="Actions"].admin-mobile-actions-cell')).not.toBeNull();
  });
});
