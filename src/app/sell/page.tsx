import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

export default async function SellWithUsPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();

  const isFr = language === "fr";

  const benefits = isFr
    ? [
        { icon: "🌿", title: "Visibilité locale", desc: "Atteignez des milliers de clients locaux passionnés par leurs animaux." },
        { icon: "⚡", title: "Mise en ligne rapide", desc: "Vos produits sont en ligne en moins de 48h après acceptation." },
        { icon: "💰", title: "Zéro frais fixes", desc: "Aucun abonnement mensuel — on ne prend une commission que sur les ventes." },
        { icon: "📦", title: "Logistique flexible", desc: "Livrez vous-même ou confiez-nous la gestion des expéditions." },
        { icon: "📊", title: "Tableau de bord vendeur", desc: "Suivez vos ventes et vos revenus en temps réel depuis votre espace." },
        { icon: "🤝", title: "Support dédié", desc: "Une équipe à votre écoute pour vous accompagner à chaque étape." },
      ]
    : [
        { icon: "🌿", title: "Local visibility", desc: "Reach thousands of local customers who love their pets." },
        { icon: "⚡", title: "Fast onboarding", desc: "Your products go live within 48 hours of approval." },
        { icon: "💰", title: "No fixed fees", desc: "No monthly subscription — we only take a commission on sales." },
        { icon: "📦", title: "Flexible logistics", desc: "Ship yourself or let us handle the deliveries." },
        { icon: "📊", title: "Vendor dashboard", desc: "Track your sales and earnings in real time from your space." },
        { icon: "🤝", title: "Dedicated support", desc: "A team ready to help you at every step." },
      ];

  const steps = isFr
    ? [
        { num: "01", title: "Soumettez votre candidature", desc: "Remplissez notre formulaire de contact en quelques minutes." },
        { num: "02", title: "On évalue votre catalogue", desc: "Notre équipe examine vos produits (qualité, conformité, pertinence)." },
        { num: "03", title: "Mise en ligne & vente", desc: "Vos produits apparaissent sur la boutique. Les ventes commencent." },
        { num: "04", title: "Paiement mensuel", desc: "On vous vire vos revenus chaque mois, directement sur votre compte." },
      ]
    : [
        { num: "01", title: "Submit your application", desc: "Fill out our contact form in just a few minutes." },
        { num: "02", title: "We review your catalog", desc: "Our team checks your products for quality, compliance and fit." },
        { num: "03", title: "Go live & start selling", desc: "Your products appear on the shop. Sales begin." },
        { num: "04", title: "Monthly payout", desc: "We send your earnings directly to your bank account each month." },
      ];

  const productTypes = isFr
    ? ["🥩 Nourriture & friandises artisanales", "🧶 Jouets faits main", "🛁 Soins & hygiène naturels", "🛏️ Lits & accessoires de confort", "🌿 Suppléments & bien-être", "🎨 Accessoires personnalisés"]
    : ["🥩 Artisan food & treats", "🧶 Handmade toys", "🛁 Natural care & hygiene", "🛏️ Beds & comfort accessories", "🌿 Supplements & wellness", "🎨 Personalised accessories"];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      {/* ── 1. Hero ── */}
      <section className="section sell-hero">
        <div className="sell-hero-inner">
          <span className="sell-hero-badge">
            {isFr ? "Partenariat vendeur" : "Vendor partnership"}
          </span>
          <h1 className="sell-hero-title">
            {isFr ? "Vendez vos produits avec nous" : "Sell your products with us"}
          </h1>
          <p className="sell-hero-sub">
            {isFr
              ? "Rejoignez Chez Olive et donnez à vos créations la vitrine qu'elles méritent. Nous connectons les artisans locaux avec des propriétaires d'animaux qui cherchent le meilleur pour leurs compagnons."
              : "Join Chez Olive and give your creations the storefront they deserve. We connect local makers with pet owners who want the best for their companions."}
          </p>
          <a href={`mailto:${business.supportEmail}`} className="btn sell-hero-btn">
            {isFr ? "Postuler maintenant →" : "Apply now →"}
          </a>
        </div>
        <div className="sell-hero-visual" aria-hidden="true">🐾</div>
      </section>

      {/* ── 2. Intro ── */}
      <section className="section">
        <div className="sell-intro">
          <div className="sell-intro-icon">🏪</div>
          <div>
            <h2 className="sell-intro-title">
              {isFr ? "Pour les entreprises locales" : "For local businesses"}
            </h2>
            <p className="small">
              {isFr
                ? "Que vous soyez artisan, producteur ou petite entreprise spécialisée dans le bien-être animal, Chez Olive est la plateforme idéale pour vendre vos produits sans vous soucier de la technologie ou du marketing. On s'occupe de la boutique, vous vous concentrez sur ce que vous faites de mieux."
                : "Whether you are a maker, producer or small business specialised in pet wellness, Chez Olive is the ideal platform to sell your products without worrying about technology or marketing. We run the shop, you focus on what you do best."}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Avantages ── */}
      <section className="section">
        <h2>{isFr ? "Pourquoi vendre chez nous ?" : "Why sell with us?"}</h2>
        <div className="sell-benefits-grid">
          {benefits.map((b) => (
            <div key={b.title} className="sell-benefit-card">
              <span className="sell-benefit-icon">{b.icon}</span>
              <strong className="sell-benefit-title">{b.title}</strong>
              <p className="small sell-benefit-desc">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Comment ça marche ── */}
      <section className="section">
        <h2>{isFr ? "Comment ça marche ?" : "How it works"}</h2>
        <div className="sell-steps">
          {steps.map((s) => (
            <div key={s.num} className="sell-step">
              <div className="sell-step-num">{s.num}</div>
              <div className="sell-step-body">
                <strong className="sell-step-title">{s.title}</strong>
                <p className="small sell-step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Types de produits ── */}
      <section className="section">
        <h2>{isFr ? "Produits recherchés" : "Products we're looking for"}</h2>
        <p className="small" style={{ marginBottom: "1rem" }}>
          {isFr
            ? "Nous privilégions les produits naturels, artisanaux et de qualité pour animaux de compagnie."
            : "We prioritise natural, handcrafted and quality products for companion animals."}
        </p>
        <div className="sell-product-types">
          {productTypes.map((p) => (
            <span key={p} className="sell-product-chip">{p}</span>
          ))}
        </div>
      </section>

      {/* ── 6. CTA final ── */}
      <section className="section sell-cta-section">
        <div className="sell-cta-inner">
          <span className="sell-cta-icon">✉️</span>
          <div>
            <h2 className="sell-cta-title">
              {isFr ? "Prêt à rejoindre l'aventure ?" : "Ready to join the adventure?"}
            </h2>
            <p className="small">
              {isFr
                ? "Envoyez-nous un email avec une description de vos produits et on vous recontacte sous 48h."
                : "Send us an email with a description of your products and we'll get back to you within 48h."}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <a href={`mailto:${business.supportEmail}`} className="btn">
                {isFr ? "Nous contacter →" : "Contact us →"}
              </a>
              <Link href="/" className="btn btn-secondary">
                {isFr ? "← Retour à la boutique" : "← Back to shop"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
