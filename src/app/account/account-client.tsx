"use client";

import { useSearchParams } from "next/navigation";
import type { Dictionary, Language } from "@/lib/i18n";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

type Props = {
  language: Language;
  t: Dictionary;
  user: { firstName: string; email: string; role: "CUSTOMER" | "ADMIN" };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    createdAtLabel: string;
    totalLabel: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
    }>;
  }>;
};

export function AccountClient({ language, t, user, orders }: Props) {
  const searchParams = useSearchParams();
  const paid = searchParams.get("paid") === "1";
  const cancelled = searchParams.get("cancelled") === "1";
  const ordered = searchParams.get("ordered");

  const reorder = async (orderId: string) => {
    const res = await fetch("/api/orders/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    if (res.ok) {
      location.reload();
      return;
    }

    alert(language === "fr" ? "Impossible de recommander." : "Could not reorder.");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={{ role: user.role }} />
      </header>

      <PromoBanner language={language} />

      <section className="section">
        <h1>
          {t.accountTitle} — {user.firstName}
        </h1>
        <p className="small">{user.email}</p>
        <p className="small">{t.orderHistory}</p>
        {paid ? (
          <p className="ok small" style={{ marginTop: 8 }}>
            {language === "fr" ? "Paiement Stripe confirmé ✅" : "Stripe payment confirmed ✅"}
          </p>
        ) : null}
        {cancelled ? (
          <p className="err small" style={{ marginTop: 8 }}>
            {language === "fr"
              ? "Paiement Stripe annulé. La commande reste en attente."
              : "Stripe payment canceled. The order remains pending."}
          </p>
        ) : null}
        {ordered ? (
          <p className="ok small" style={{ marginTop: 8 }}>
            {language === "fr"
              ? `Commande ${ordered} créée avec succès ✅`
              : `Order ${ordered} created successfully ✅`}
          </p>
        ) : null}
      </section>

      <section className="section">
        {orders.length === 0 ? (
          <p className="small">{language === "fr" ? "Aucune commande pour le moment." : "No orders yet."}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === "fr" ? "Commande" : "Order"}</th>
                  <th>{language === "fr" ? "Date" : "Date"}</th>
                  <th>{language === "fr" ? "Statut" : "Status"}</th>
                  <th>{language === "fr" ? "Paiement" : "Payment"}</th>
                  <th>{language === "fr" ? "Total" : "Total"}</th>
                  <th>{language === "fr" ? "Articles" : "Items"}</th>
                  <th>{language === "fr" ? "Action" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.createdAtLabel}</td>
                    <td>{order.status}</td>
                    <td>{order.paymentStatus}</td>
                    <td>{order.totalLabel}</td>
                    <td>
                      {order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}
                    </td>
                    <td>
                      <button className="btn" onClick={() => void reorder(order.id)}>
                        {t.reorder}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
