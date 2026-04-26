"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";

type Props = {
  language: Language;
  t: Dictionary;
  customers: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    ordersCount: number;
    createdAtLabel: string;
    detailsHref: string;
  }>;
};

export function AdminCustomersClient({ language, t, customers }: Props) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(10);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const normalizedSearch = customerSearch.toLowerCase();
      const searchOk =
        !customerSearch ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.fullName.toLowerCase().includes(normalizedSearch);

      const roleOk = !roleFilter || customer.role === roleFilter;
      return searchOk && roleOk;
    });
  }, [customers, customerSearch, roleFilter]);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const pagedCustomers = filteredCustomers.slice(
    (safeCustomerPage - 1) * customerPageSize,
    safeCustomerPage * customerPageSize,
  );

  const clearCustomerFilters = () => {
    setCustomerSearch("");
    setRoleFilter("");
    setCustomerPage(1);
  };

  return (
    <>
      <section className="section">
        <h1>{t.customers}</h1>
        <p className="small">
          {language === "fr" ? "Gérez tous les clients de la boutique." : "Manage all shop customers."}
        </p>
      </section>

      <section className="section">
        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Recherche nom/email" : "Search name/email"}
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 240 }}
          />

          <select
            className="select"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setCustomerPage(1);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="">{language === "fr" ? "Tous les rôles" : "All roles"}</option>
            {Array.from(new Set(customers.map((customer) => customer.role))).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(customerPageSize)}
            onChange={(event) => {
              setCustomerPageSize(Number(event.target.value));
              setCustomerPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>

          <button className="btn" onClick={clearCustomerFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button
            className="btn"
            onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
            disabled={safeCustomerPage <= 1}
          >
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeCustomerPage}/{customerTotalPages} · {filteredCustomers.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setCustomerPage((page) => Math.min(customerTotalPages, page + 1))}
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
                <th>{language === "fr" ? "Profil" : "Profile"}</th>
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
                  <td>
                    <Link className="btn btn-secondary" href={customer.detailsHref}>
                      {language === "fr" ? "Voir profil" : "View profile"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

