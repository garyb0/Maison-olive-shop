import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminCustomerDetail } from "@/lib/admin";
import { getDeliveryAddressesForUser } from "@/lib/delivery-addresses";
import { formatCurrency, formatDate } from "@/lib/format";

type AdminCustomerDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function formatName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function formatAddressLine(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function getAssignedAdminLabel(
  assignedAdmin:
    | {
        firstName: string;
        lastName: string;
        email: string;
      }
    | null,
) {
  if (!assignedAdmin) return "-";
  const fullName = formatName(assignedAdmin.firstName, assignedAdmin.lastName);
  return fullName || assignedAdmin.email;
}

export default async function AdminCustomerDetailsPage({ params }: AdminCustomerDetailsPageProps) {
  const { id } = await params;
  const [language, adminUser, customer] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getAdminCustomerDetail(id),
  ]);
  const t = getDictionary(language);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  if (!adminUser || adminUser.role !== "ADMIN") {
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

  if (!customer) {
    notFound();
  }

  const addresses = await getDeliveryAddressesForUser(customer.id);
  const customerName = formatName(customer.firstName, customer.lastName);

  return (
    <>
      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1>{language === "fr" ? "Profil client" : "Customer profile"}</h1>
            <p className="small">
              {customerName || customer.email} · {customer.email}
            </p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-secondary" href="/admin/customers">
              {language === "fr" ? "Retour aux clients" : "Back to customers"}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Résumé du compte" : "Account summary"}</h2>
        <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
          <div>
            <p className="small">{language === "fr" ? "Nom" : "Name"}</p>
            <strong>{customerName || "-"}</strong>
          </div>
          <div>
            <p className="small">Email</p>
            <strong>{customer.email}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Rôle" : "Role"}</p>
            <span className="badge">{customer.role}</span>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Langue" : "Language"}</p>
            <span className="badge">{customer.language.toUpperCase()}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 24, flexWrap: "wrap", marginTop: 18 }}>
          <div>
            <p className="small">{language === "fr" ? "Compte créé" : "Account created"}</p>
            <strong>{formatDate(customer.createdAt, locale)}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Dernière mise à jour" : "Last update"}</p>
            <strong>{formatDate(customer.updatedAt, locale)}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Commandes" : "Orders"}</p>
            <strong>{customer._count.orders}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Adresses" : "Addresses"}</p>
            <strong>{customer._count.deliveryAddresses}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Conversations support" : "Support conversations"}</p>
            <strong>{customer._count.customerSupportConversations}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Abonnements" : "Subscriptions"}</p>
            <strong>{customer._count.subscriptions}</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Adresses de livraison" : "Delivery addresses"}</h2>
        {addresses.length === 0 ? (
          <p className="small">
            {language === "fr"
              ? "Aucune adresse enregistrée pour ce client."
              : "No saved addresses for this customer."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {addresses.map((address) => (
              <article className="card" key={address.id} style={{ padding: 18 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <strong>{address.label}</strong>
                    <p className="small" style={{ marginTop: 6 }}>
                      {formatAddressLine([
                        address.shippingLine1,
                        address.shippingCity,
                        address.shippingRegion,
                        address.shippingPostal,
                        address.shippingCountry,
                      ])}
                    </p>
                  </div>
                  <span className="badge">
                    {address.lastUsedAt
                      ? language === "fr"
                        ? `Utilisée ${formatDate(address.lastUsedAt, locale)}`
                        : `Used ${formatDate(address.lastUsedAt, locale)}`
                      : language === "fr"
                        ? "Jamais utilisée"
                        : "Never used"}
                  </span>
                </div>
                <div className="row" style={{ gap: 24, flexWrap: "wrap", marginTop: 12 }}>
                  <p className="small">
                    {language === "fr" ? "Téléphone" : "Phone"}: {address.deliveryPhone ?? "-"}
                  </p>
                  <p className="small">
                    {language === "fr" ? "Instructions" : "Instructions"}: {address.deliveryInstructions ?? "-"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2>{language === "fr" ? "Commandes récentes" : "Recent orders"}</h2>
          <span className="small">
            {language === "fr" ? "Vue utile pour aider le client rapidement." : "Quick view to help the customer fast."}
          </span>
        </div>
        {customer.orders.length === 0 ? (
          <p className="small">
            {language === "fr" ? "Aucune commande pour ce client." : "No orders for this customer."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{language === "fr" ? "Commande" : "Order"}</th>
                  <th>{language === "fr" ? "Statut" : "Status"}</th>
                  <th>{language === "fr" ? "Paiement" : "Payment"}</th>
                  <th>{language === "fr" ? "Livraison" : "Delivery"}</th>
                  <th>{language === "fr" ? "Total" : "Total"}</th>
                  <th>{language === "fr" ? "Créée" : "Created"}</th>
                  <th>{language === "fr" ? "Action" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.orderNumber}</td>
                    <td><span className="badge">{order.status}</span></td>
                    <td><span className="badge">{order.paymentStatus}</span></td>
                    <td><span className="badge">{order.deliveryStatus}</span></td>
                    <td>{formatCurrency(order.totalCents, order.currency, locale)}</td>
                    <td>{formatDate(order.createdAt, locale)}</td>
                    <td>
                      <Link className="btn btn-secondary" href={`/admin/orders/${order.id}`}>
                        {language === "fr" ? "Voir la commande" : "View order"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Support récent" : "Recent support"}</h2>
        {customer.customerSupportConversations.length === 0 ? (
          <p className="small">
            {language === "fr"
              ? "Aucune conversation de support liée à ce compte."
              : "No support conversations linked to this account."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {customer.customerSupportConversations.map((conversation) => (
              <article className="card" key={conversation.id} style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{language === "fr" ? "Conversation support" : "Support conversation"}</strong>
                      <span className="badge">{conversation.status}</span>
                    </div>
                    <p className="small" style={{ marginTop: 6 }}>
                      {language === "fr" ? "Assignée à" : "Assigned to"}: {getAssignedAdminLabel(conversation.assignedAdmin)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="small">{formatDate(conversation.lastMessageAt, locale)}</p>
                    <p className="small">
                      {language === "fr" ? "Ouverte le" : "Opened on"} {formatDate(conversation.createdAt, locale)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Abonnements" : "Subscriptions"}</h2>
        {customer.subscriptions.length === 0 ? (
          <p className="small">
            {language === "fr" ? "Aucun abonnement actif ou recent." : "No active or recent subscriptions."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {customer.subscriptions.map((subscription) => (
              <article className="card" key={subscription.id} style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{language === "fr" ? subscription.product.nameFr : subscription.product.nameEn}</strong>
                      <span className="badge">{subscription.status}</span>
                    </div>
                    <p className="small" style={{ marginTop: 6 }}>
                      {language === "fr" ? "Quantité" : "Quantity"}: {subscription.quantity}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="small">
                      {language === "fr" ? "Fin de période" : "Period end"}: {formatDate(subscription.currentPeriodEnd, locale)}
                    </p>
                    <p className="small">
                      {subscription.cancelAtPeriodEnd
                        ? language === "fr"
                          ? "Annulation en fin de période"
                          : "Cancels at period end"
                        : language === "fr"
                          ? "Renouvellement actif"
                          : "Auto-renew active"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
