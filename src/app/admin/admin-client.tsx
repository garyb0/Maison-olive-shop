"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";

type Props = {
  language: Language;
  t: Dictionary;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalLabel: string;
    createdAtLabel: string;
  }>;
  customers: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    ordersCount: number;
    createdAtLabel: string;
  }>;
  taxSummary: {
    subtotalLabel: string;
    taxesLabel: string;
    shippingLabel: string;
    totalLabel: string;
  };
};

export function AdminClient({ language, t, orders, customers, taxSummary }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  const [customerSearch, setCustomerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusOk = !statusFilter || order.status === statusFilter;
      const paymentOk = !paymentFilter || order.paymentStatus === paymentFilter;
      const customerOk =
        !customerFilter ||
        order.customerEmail.toLowerCase().includes(customerFilter.toLowerCase()) ||
        order.customerName.toLowerCase().includes(customerFilter.toLowerCase());

      return statusOk && paymentOk && customerOk;
    });
  }, [orders, statusFilter, paymentFilter, customerFilter]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderTotalPages);
  const pagedOrders = filteredOrders.slice((safeOrderPage - 1) * orderPageSize, safeOrderPage * orderPageSize);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchOk =
        !customerSearch ||
        customer.email.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.fullName.toLowerCase().includes(customerSearch.toLowerCase());

      const roleOk = !roleFilter || customer.role === roleFilter;
      return searchOk && roleOk;
    });
  }, [customers, customerSearch, roleFilter]);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const pagedCustomers = filteredCustomers.slice((safeCustomerPage - 1) * customerPageSize, safeCustomerPage * customerPageSize);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <nav className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/account">
            {t.navAccount}
          </Link>
          <Link className="pill-link" href="/faq">
            {t.navFaq}
          </Link>
          <Link className="pill-link" href="/terms">
            {t.navTerms}
          </Link>
          <Link className="pill-link" href="/returns">
            {t.navReturns}
          </Link>
        </nav>
      </header>

      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr"
            ? "Panneau admin pour surveiller les commandes, clients et taxes."
            : "Admin panel to monitor orders, customers and taxes."}
        </p>
      </section>

      <section className="section">
        <h2>{t.taxReport}</h2>
        <div className="row" style={{ gap: 16 }}>
          <span className="badge">
            {language === "fr" ? "Sous-total" : "Subtotal"}: {taxSummary.subtotalLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Taxes" : "Taxes"}: {taxSummary.taxesLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Livraison" : "Shipping"}: {taxSummary.shippingLabel}
          </span>
          <span className="badge">
            {language === "fr" ? "Total" : "Total"}: {taxSummary.totalLabel}
          </span>
          <a className="btn" href="/api/admin/taxes?format=csv">
            {t.taxesExportCsv}
          </a>
        </div>
      </section>

      <section className="section">
        <h2>{t.orders}</h2>

        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Filtre client/email" : "Filter customer/email"}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 240 }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous les statuts" : "All statuses"}</option>
            {Array.from(new Set(orders.map((o) => o.status))).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous paiements" : "All payments"}</option>
            {Array.from(new Set(orders.map((o) => o.paymentStatus))).map((ps) => (
              <option key={ps} value={ps}>
                {ps}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(orderPageSize)}
            onChange={(e) => {
              setOrderPageSize(Number(e.target.value));
              setOrderPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={safeOrderPage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeOrderPage}/{orderTotalPages} · {filteredOrders.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
            disabled={safeOrderPage >= orderTotalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Commande" : "Order"}</th>
                <th>{language === "fr" ? "Client" : "Customer"}</th>
                <th>Email</th>
                <th>{language === "fr" ? "Date" : "Date"}</th>
                <th>{language === "fr" ? "Statut" : "Status"}</th>
                <th>{language === "fr" ? "Paiement" : "Payment"}</th>
                <th>{language === "fr" ? "Total" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.customerEmail}</td>
                  <td>{order.createdAtLabel}</td>
                  <td>{order.status}</td>
                  <td>{order.paymentStatus}</td>
                  <td>{order.totalLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{t.customers}</h2>

        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Recherche nom/email" : "Search name/email"}
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 240 }}
          />

          <select
            className="select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="">{language === "fr" ? "Tous rôles" : "All roles"}</option>
            {Array.from(new Set(customers.map((c) => c.role))).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(customerPageSize)}
            onChange={(e) => {
              setCustomerPageSize(Number(e.target.value));
              setCustomerPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setCustomerPage((p) => Math.max(1, p - 1))} disabled={safeCustomerPage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeCustomerPage}/{customerTotalPages} · {filteredCustomers.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
            disabled={safeCustomerPage >= customerTotalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Nom" : "Name"}</th>
                <th>Email</th>
                <th>{language === "fr" ? "Rôle" : "Role"}</th>
                <th>{language === "fr" ? "Nb commandes" : "Orders"}</th>
                <th>{language === "fr" ? "Créé" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.fullName}</td>
                  <td>{customer.email}</td>
                  <td>{customer.role}</td>
                  <td>{customer.ordersCount}</td>
                  <td>{customer.createdAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
