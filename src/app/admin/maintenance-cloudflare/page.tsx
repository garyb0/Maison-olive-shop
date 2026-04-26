import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";

const ROUTES = ["chezolive.ca/*", "www.chezolive.ca/*", "chezolive.com/*", "www.chezolive.com/*"] as const;

export default async function AdminMaintenanceCloudflarePage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{language === "fr" ? "Aide maintenance Cloudflare" : "Cloudflare maintenance help"}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/admin">
          {language === "fr" ? "Retour a l'administration" : "Back to admin"}
        </Link>
      </section>
    );
  }

  const isFrench = language === "fr";

  return (
    <section className="section">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>{isFrench ? "Aide maintenance Cloudflare" : "Cloudflare maintenance help"}</h1>
          <p className="small" style={{ marginTop: 0 }}>
            {isFrench
              ? "Cette page explique comment activer la maintenance externe si le PC local, PM2 ou le tunnel tombent."
              : "This page explains how to activate external maintenance if the local PC, PM2, or the tunnel goes down."}
          </p>
        </div>
        <Link className="btn btn-secondary" href="/admin">
          {isFrench ? "Retour au dashboard" : "Back to dashboard"}
        </Link>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid rgba(180, 83, 9, 0.18)",
          borderRadius: 16,
          background: "rgba(255, 247, 237, 0.9)",
        }}
      >
        <strong>{isFrench ? "Quand l'utiliser" : "When to use it"}</strong>
        <p className="small" style={{ marginTop: 8 }}>
          {isFrench
            ? "Utilise cette maintenance Cloudflare seulement en urgence: panne du PC, tunnel Cloudflare coupe, PM2 down, ou gros incident applicatif."
            : "Use this Cloudflare maintenance only in emergencies: PC outage, broken Cloudflare Tunnel, PM2 down, or major app incident."}
        </p>
      </div>

      <div className="section" style={{ padding: 0, marginTop: 18 }}>
        <h2>{isFrench ? "Activation en 60 secondes" : "60-second activation"}</h2>
        <ol className="small" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>{isFrench ? "Ouvre Cloudflare puis Workers Routes pour la zone chezolive.ca." : "Open Cloudflare, then Workers Routes for the chezolive.ca zone."}</li>
          <li>
            {isFrench
              ? "Clique Add route et associe le Worker"
              : "Click Add route and attach the Worker"}{" "}
            <code>chezolive-maintenance</code>.
          </li>
          <li>{isFrench ? "Ajoute ces 4 routes publiques:" : "Add these 4 public routes:"}</li>
        </ol>
        <div
          style={{
            border: "1px solid rgba(120, 113, 108, 0.16)",
            borderRadius: 14,
            padding: 14,
            background: "rgba(250, 250, 249, 0.95)",
          }}
        >
          {ROUTES.map((route) => (
            <p key={route} style={{ margin: "6px 0", fontFamily: "monospace" }}>
              {route}
            </p>
          ))}
        </div>
        <ol className="small" start={4} style={{ paddingLeft: 20, lineHeight: 1.8, marginTop: 12 }}>
          <li>
            {isFrench
              ? "Sauvegarde les routes. Le site public affichera alors la page de maintenance externe sur tous les domaines."
              : "Save the routes. The public site will then show the external maintenance page on all domains."}
          </li>
          <li>
            {isFrench
              ? "Teste chezolive.ca et www.chezolive.ca pour confirmer que la page s'affiche."
              : "Test chezolive.ca and www.chezolive.ca to confirm the page is shown."}
          </li>
        </ol>
      </div>

      <div className="section" style={{ padding: 0 }}>
        <h2>{isFrench ? "Desactivation" : "Deactivation"}</h2>
        <p className="small">
          {isFrench
            ? "Quand l'app est revenue, retourne dans Workers Routes et retire les 4 routes. Le trafic reviendra alors vers le tunnel et le site normal."
            : "When the app is back, return to Workers Routes and remove the 4 routes. Traffic will then go back to the tunnel and the normal site."}
        </p>
      </div>

      <div className="section" style={{ padding: 0 }}>
        <h2>{isFrench ? "Difference avec la maintenance admin actuelle" : "Difference from the current admin maintenance"}</h2>
        <p className="small">
          {isFrench
            ? "Le bouton maintenance du tableau de bord ferme le site via l'app et permet une réouverture planifiée. La maintenance Cloudflare, elle, est externe et sert de coupe-circuit si l'origine ne répond plus du tout."
            : "The dashboard maintenance button closes the site through the app and supports scheduled reopening. Cloudflare maintenance is external and acts as a hard stop if the origin stops responding entirely."}
        </p>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn" href="/admin">
          {isFrench ? "Retour au dashboard" : "Back to dashboard"}
        </Link>
        <Link className="btn btn-secondary" href="/">
          {t.navHome}
        </Link>
      </div>
    </section>
  );
}

