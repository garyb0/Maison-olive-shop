import type { Language } from "@/lib/i18n";

type BusinessInfo = {
  brand: string;
  supportEmail: string;
  supportHours: string;
  shippingPolicy: string;
};

export type HelpCard = {
  title: string;
  description: string;
  href: string;
  external?: boolean;
};

export type HelpSection = {
  title: string;
  body: string;
};

export type HelpQuestion = {
  q: string;
  a: string;
};

export function getHelpCenterCards(language: Language, business: BusinessInfo): HelpCard[] {
  if (language === "fr") {
    return [
      {
        title: "FAQ",
        description: "Les r\u00e9ponses rapides aux questions les plus fr\u00e9quentes.",
        href: "#faq",
      },
      {
        title: "Livraison",
        description: "Zone desservie, d\u00e9lais, livraison gratuite et planification.",
        href: "/shipping",
      },
      {
        title: "Retours et remboursements",
        description: "Conditions, d\u00e9lai, articles admissibles et proc\u00e9dure de contact.",
        href: "/returns",
      },
      {
        title: "Conditions de vente",
        description: "Version courte et claire des r\u00e8gles qui encadrent la commande.",
        href: "/terms",
      },
      {
        title: "Nous joindre",
        description: `${business.supportEmail} - ${business.supportHours}`,
        href: `mailto:${business.supportEmail}`,
        external: true,
      },
    ];
  }

  return [
    {
      title: "FAQ",
      description: "Quick answers to the questions customers ask most often.",
      href: "#faq",
    },
    {
      title: "Shipping",
      description: "Delivery area, timing, free shipping, and scheduling details.",
      href: "/shipping",
    },
    {
      title: "Returns and refunds",
      description: "Conditions, timing, eligible items, and how to contact us.",
      href: "/returns",
    },
    {
      title: "Terms",
      description: "A short, clear version of the rules that apply to an order.",
      href: "/terms",
    },
    {
      title: "Contact us",
      description: `${business.supportEmail} - ${business.supportHours}`,
      href: `mailto:${business.supportEmail}`,
      external: true,
    },
  ];
}

export function getHelpCenterQuestions(language: Language, business: BusinessInfo): HelpQuestion[] {
  if (language === "fr") {
    return [
      {
        q: "Comment suivre ma commande ?",
        a: "Depuis Mon compte, tu peux consulter l\u2019historique et le d\u00e9tail de ta commande. Tu re\u00e7ois aussi un courriel de confirmation apr\u00e8s l\u2019achat.",
      },
      {
        q: "O\u00f9 livrez-vous ?",
        a: "Chez Olive dessert surtout Rimouski et les environs. Le passage \u00e0 la caisse confirme si l\u2019adresse entre bien dans notre zone locale.",
      },
      {
        q: "Quels modes de paiement sont accept\u00e9s ?",
        a: "Selon la commande, le paiement peut se faire avec Stripe ou en mode manuel. Le mode disponible est toujours affich\u00e9 clairement au passage \u00e0 la caisse.",
      },
      {
        q: "O\u00f9 voir les frais, les taxes et le total ?",
        a: "Le passage \u00e0 la caisse affiche le sous-total, la livraison, le total avant taxes, la TPS, la TVQ et le total final avant de confirmer la commande.",
      },
      {
        q: "Que faire si j\u2019ai un probl\u00e8me avec ma commande ?",
        a: `\u00c9cris-nous \u00e0 ${business.supportEmail} et nous pourrons t\u2019aider pour une commande, une livraison ou un retour.`,
      },
    ];
  }

  return [
    {
      q: "How do I track my order?",
      a: "From My account you can view your order history and order details. You also receive a confirmation email after checkout.",
    },
    {
      q: "Where do you deliver?",
      a: "Chez Olive mainly serves Rimouski and nearby areas. Checkout confirms whether your address is inside our local delivery zone.",
    },
    {
      q: "Which payment methods are accepted?",
      a: "Depending on the order, payment may be made with Stripe or through manual payment. The available option is always shown clearly at checkout.",
    },
    {
      q: "Where can I see fees, taxes, and the final total?",
      a: "Checkout shows the subtotal, shipping, total before taxes, GST, QST, and final total before the order is confirmed.",
    },
    {
      q: "What should I do if there is a problem with my order?",
      a: `Email us at ${business.supportEmail} and we will help with an order, delivery, or return issue.`,
    },
  ];
}

export function getShippingSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Zone desservie",
        body: "La livraison est offerte surtout \u00e0 Rimouski et dans les environs. L\u2019adresse est valid\u00e9e au passage \u00e0 la caisse pour confirmer si elle fait partie de la zone locale desservie.",
      },
      {
        title: "D\u00e9lais et planification",
        body: "Les d\u00e9lais affich\u00e9s sont estimatifs. Certaines commandes peuvent \u00eatre planifi\u00e9es manuellement si aucun cr\u00e9neau imm\u00e9diat n\u2019est disponible.",
      },
      {
        title: "Frais de livraison",
        body: business.shippingPolicy,
      },
      {
        title: "Avant de confirmer la commande",
        body: "Le passage \u00e0 la caisse affiche toujours les frais de livraison, les taxes et le total final avant la confirmation. Tu peux donc valider clairement le montant \u00e0 payer.",
      },
      {
        title: "Besoin d\u2019aide ?",
        body: `Pour une question sur une adresse ou une livraison, \u00e9cris-nous \u00e0 ${business.supportEmail}.`,
      },
    ];
  }

  return [
    {
      title: "Delivery area",
      body: "Delivery is mainly offered in Rimouski and nearby areas. The address is checked at checkout to confirm whether it is inside the local service zone.",
    },
    {
      title: "Timing and scheduling",
      body: "Displayed timing is estimated. Some orders may require manual scheduling if no immediate delivery slot is available.",
    },
    {
      title: "Shipping fees",
      body: business.shippingPolicy,
    },
    {
      title: "Before you confirm your order",
      body: "Checkout always shows shipping fees, taxes, and the final total before confirmation, so the amount to pay stays clear.",
    },
    {
      title: "Need help?",
      body: `For a delivery or address question, email us at ${business.supportEmail}.`,
    },
  ];
}

export function getReturnsSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Demande de retour",
        body: "Tu peux demander un retour dans les 14 jours suivant la r\u00e9ception de la commande. La demande doit \u00eatre valid\u00e9e par notre \u00e9quipe avant le traitement final.",
      },
      {
        title: "Articles admissibles",
        body: "Les produits doivent \u00eatre non utilis\u00e9s et retourn\u00e9s dans leur emballage d\u2019origine, avec tous les \u00e9l\u00e9ments inclus.",
      },
      {
        title: "Remboursement",
        body: "Lorsqu\u2019un retour est accept\u00e9 et re\u00e7u, le remboursement est g\u00e9n\u00e9ralement trait\u00e9 dans un d\u00e9lai de 5 \u00e0 10 jours ouvrables.",
      },
      {
        title: "Article d\u00e9fectueux ou probl\u00e8me de commande",
        body: "Si un article arrive endommag\u00e9, d\u00e9fectueux ou ne correspond pas \u00e0 la commande, contacte-nous rapidement pour qu\u2019on puisse corriger la situation.",
      },
      {
        title: "Contact retours",
        body: `Pour lancer une demande, \u00e9cris-nous \u00e0 ${business.supportEmail}.`,
      },
    ];
  }

  return [
    {
      title: "Return request",
      body: "You can request a return within 14 days of receiving the order. The request must be reviewed by our team before final processing.",
    },
    {
      title: "Eligible items",
      body: "Products must be unused and returned in their original packaging, with all included items.",
    },
    {
      title: "Refund",
      body: "Once an approved return is received, the refund is generally processed within 5 to 10 business days.",
    },
    {
      title: "Defective item or order issue",
      body: "If an item arrives damaged, defective, or does not match the order, contact us quickly so we can resolve the issue.",
    },
    {
      title: "Returns contact",
      body: `To start a request, email us at ${business.supportEmail}.`,
    },
  ];
}

export function getTermsSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Commer\u00e7ant",
        body: `${business.brand} est une boutique locale qui vend ses produits en ligne avec support client par courriel \u00e0 ${business.supportEmail}.`,
      },
      {
        title: "Commande et paiement",
        body: "Les commandes sont soumises \u00e0 la disponibilit\u00e9 des produits. Le mode de paiement offert est affich\u00e9 au passage \u00e0 la caisse avant la confirmation.",
      },
      {
        title: "Prix et disponibilit\u00e9",
        body: "Les prix sont affich\u00e9s en dollars canadiens. Malgr\u00e9 le soin apport\u00e9 au site, une erreur \u00e9vidente de prix, de description ou de disponibilit\u00e9 peut \u00eatre corrig\u00e9e avant l\u2019ex\u00e9cution de la commande.",
      },
      {
        title: "Livraison",
        body: "La livraison et sa planification d\u00e9pendent de l\u2019adresse, de la zone desservie et des disponibilit\u00e9s. Les frais applicables et le total sont affich\u00e9s avant la confirmation.",
      },
      {
        title: "Retours",
        body: "Les retours et remboursements sont g\u00e9r\u00e9s selon la politique affich\u00e9e sur la page Retours et remboursements.",
      },
      {
        title: "Contact",
        body: `Pour toute question li\u00e9e \u00e0 une commande, un paiement ou une livraison, \u00e9cris-nous \u00e0 ${business.supportEmail}.`,
      },
    ];
  }

  return [
    {
      title: "Merchant",
      body: `${business.brand} is a local shop selling products online with customer support by email at ${business.supportEmail}.`,
    },
    {
      title: "Orders and payment",
      body: "Orders are subject to product availability. The offered payment method is shown at checkout before the order is confirmed.",
    },
    {
      title: "Pricing and availability",
      body: "Prices are displayed in Canadian dollars. Despite the care put into the site, an obvious pricing, description, or availability error may be corrected before the order is fulfilled.",
    },
    {
      title: "Shipping",
      body: "Delivery and scheduling depend on the address, the service area, and current availability. Applicable fees and the final total are shown before confirmation.",
    },
    {
      title: "Returns",
      body: "Returns and refunds are handled according to the policy shown on the Returns and refunds page.",
    },
    {
      title: "Contact",
      body: `For any question related to an order, payment, or delivery, email us at ${business.supportEmail}.`,
    },
  ];
}
