export { default } from "./page.next";
/*
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDeliveryAddressesForUser } from "@/lib/delivery-addresses";
import { AccountProfileClient } from "./profile-client";

export default async function AccountProfilePage() {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();

  return (
    <section className="section">
      <h1>{language === "fr" ? "Mon profil" : "My profile"}</h1>
      <p className="small" style={{ marginBottom: 24 }}>
        {language === "fr" ? "Gère tes informations personnelles." : "Manage your personal information."}
      </p>

      <div className="card" style={{ maxWidth: 600, padding: 24 }}>
        <div className="two-col">
          <div className="field">
            <label>{language === "fr" ? "Prénom" : "First name"}</label>
            <input className="input" defaultValue={user?.firstName} readOnly />
          </div>
          <div className="field">
            <label>{language === "fr" ? "Nom" : "Last name"}</label>
            <input className="input" defaultValue={user?.lastName} readOnly />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>{language === "fr" ? "Adresse email" : "Email address"}</label>
            <input className="input" defaultValue={user?.email} readOnly />
          </div>
        </div>

        <p className="small ok" style={{ marginTop: 16 }}>
          {language === "fr" ? "✅ Ton profil est à jour." : "✅ Your profile is up to date."}
        </p>
      </div>
    </section>
  );
}
*/
