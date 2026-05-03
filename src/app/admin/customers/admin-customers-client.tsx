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
      <section className="section admin-page-header">
        <div className="admin-page-header__copy">
          <span className="admin-page-header__eyebrow">
            {language === "fr" ? "Clients" : "Customers"}
          </span>
          <h1>{t.customers}</h1>
          <p className="small">
            {language === "fr"
              ? "Recherche les comptes, ouvre rapidement les profils et garde le contexte de commandes."
              : "Search accounts, open profiles quickly, and keep order context close."}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="admin-toolbar">
          <input
            className="input admin-filter-control"
            placeholder={language === "fr" ? "Recherche nom/email" : "Search name/email"}
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setCustomerPage(1);
            }}
          />

          <select
            className="select admin-filter-control"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setCustomerPage(1);
            }}
          >
            <option value="">{language === "fr" ? "Tous les rôles" : "All roles"}</option>
            {Array.from(new Set(customers.map((customer) => customer.role))).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select
            className="select admin-filter-control admin-filter-control--short"
            value={String(customerPageSize)}
            onChange={(event) => {
              setCustomerPageSize(Number(event.target.value));
              setCustomerPage(1);
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>

          <button className="btn" onClick={clearCustomerFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="admin-pagination">
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

        <div className="table-wrap admin-mobile-table-wrap">
          <table className="admin-mobile-table">
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
                  <td data-label={language === "fr" ? "Nom" : "Name"}>{customer.fullName}</td>
                  <td data-label="Email">{customer.email}</td>
                  <td data-label={language === "fr" ? "Rôle" : "Role"}>{customer.role}</td>
                  <td data-label={language === "fr" ? "Commandes" : "Orders"}>{customer.ordersCount}</td>
                  <td data-label={language === "fr" ? "Créé" : "Created"}>{customer.createdAtLabel}</td>
                  <td className="admin-mobile-actions-cell" data-label={language === "fr" ? "Profil" : "Profile"}>
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

