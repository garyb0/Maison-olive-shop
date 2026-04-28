import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminCustomers } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { AdminCustomersClient } from "./admin-customers-client";

type AdminCustomers = Awaited<ReturnType<typeof getAdminCustomers>>;
type AdminCustomer = AdminCustomers[number];

export default async function AdminCustomersPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

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

  const customers = await getAdminCustomers();

  return (
    <AdminCustomersClient
      language={language}
      t={t}
      customers={customers.map((customer: AdminCustomer) => ({
        id: customer.id,
        email: customer.email,
        fullName: `${customer.firstName} ${customer.lastName}`,
        role: customer.role,
        ordersCount: customer.orders.length,
        createdAtLabel: formatDate(customer.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
        detailsHref: `/admin/customers/${customer.id}`,
      }))}
    />
  );
}
