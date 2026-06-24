import type { Language } from "@/lib/i18n";

type BusinessInfo = {
  brand: string;
  supportEmail: string;
  supportHours: string;
  shippingPolicy: string;
};

export const helpTopicIds = [
  "livraison",
  "commandes",
  "paiement",
  "retours",
  "compte",
  "conditions",
] as const;

export type HelpTopicId = (typeof helpTopicIds)[number];

export type HelpQuickAction = {
  title: string;
  description: string;
  href?: string;
  eventName?: "chezolive:support-open";
  primary?: boolean;
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

export type HelpTopic = {
  id: HelpTopicId;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  ctaLabel?: string;
  ctaHref?: string;
};

export type HelpQuestion = {
  q: string;
  a: string;
  topicId?: HelpTopicId;
};

export function getHelpQuickActions(language: Language): HelpQuickAction[] {
  if (language === "fr") {
    return [
      {
        title: "Écrire à l’équipe",
        description: "Une question sur une commande, un produit ou un souci à régler.",
        eventName: "chezolive:support-open",
        primary: true,
      },
      {
        title: "Suivre ma commande",
        description: "Retrouve l’historique, les statuts et les détails dans ton compte.",
        href: "/account/orders",
      },
      {
        title: "Voir la livraison à domicile",
        description: "Zone desservie, frais, seuil gratuit et créneaux disponibles.",
        href: "/faq#livraison",
      },
      {
        title: "Retour ou problème",
        description: "Lance une demande simple si un article ne convient pas.",
        href: "/faq#retours",
      },
    ];
  }

  return [
    {
      title: "Message the team",
      description: "Ask about an order, a product, or something we can fix.",
      eventName: "chezolive:support-open",
      primary: true,
    },
    {
      title: "Track my order",
      description: "Find your order history, statuses, and details in your account.",
      href: "/account/orders",
    },
    {
      title: "View home delivery",
      description: "Service area, fees, free-delivery threshold, and available slots.",
      href: "/faq#livraison",
    },
    {
      title: "Return or issue",
      description: "Start a simple request when something is not right.",
      href: "/faq#retours",
    },
  ];
}

export function getHelpTopics(language: Language, business: BusinessInfo): HelpTopic[] {
  if (language === "fr") {
    return [
      {
        id: "livraison",
        eyebrow: "Livraison",
        title: "Livraison à domicile à Rimouski",
        body: "Chez Olive est une boutique animalière locale avec livraison à domicile à Rimouski et dans les environs. L’adresse est validée au panier et au passage à la caisse pour confirmer les options disponibles.",
        points: [
          business.shippingPolicy,
          "Les frais, les taxes et le total final sont affichés avant la confirmation.",
          "Les créneaux disponibles peuvent varier selon la zone, la charge de tournée et les produits.",
        ],
        ctaLabel: "Magasiner avec livraison",
        ctaHref: "/boutique",
      },
      {
        id: "commandes",
        eyebrow: "Commandes",
        title: "Commandes et suivi",
        body: "Ton compte regroupe les commandes passées, les statuts et les détails importants. Tu reçois aussi un courriel de confirmation après l’achat.",
        points: [
          "Le suivi se fait dans Mon compte, section Mes commandes.",
          "Pour modifier une adresse ou une note, écris-nous rapidement avant la préparation.",
          "Si une commande demande une validation manuelle, l’équipe te contactera.",
        ],
        ctaLabel: "Voir mes commandes",
        ctaHref: "/account/orders",
      },
      {
        id: "paiement",
        eyebrow: "Paiement",
        title: "Paiement clair avant confirmation",
        body: "Le mode de paiement disponible est affiché au passage à la caisse. Selon la commande, le paiement peut passer par Stripe ou être géré manuellement.",
        points: [
          "Les prix sont en dollars canadiens.",
          "Le sous-total, la livraison, la TPS, la TVQ et le total final sont visibles avant de confirmer.",
          "Aucun changement de montant n’est caché après la validation.",
        ],
      },
      {
        id: "retours",
        eyebrow: "Retours",
        title: "Retour, échange ou problème",
        body: "Si un article arrive abîmé, ne correspond pas à la commande ou ne convient pas, contacte l’équipe. On valide la meilleure solution avec toi.",
        points: [
          "Les retours doivent être demandés dans les 14 jours suivant la réception.",
          "Les articles doivent être non utilisés et dans leur emballage d’origine, sauf défaut ou erreur de commande.",
          "Une photo peut aider à traiter plus vite un article endommagé.",
        ],
        ctaLabel: "Écrire pour un retour",
        ctaHref: `mailto:${business.supportEmail}`,
      },
      {
        id: "compte",
        eyebrow: "Compte",
        title: "Mon Chez Olive",
        body: "Ton espace client centralise les commandes, les adresses et les informations utiles pour simplifier les prochaines visites.",
        points: [
          "Tu peux consulter l’historique de commandes et les détails de livraison.",
          "Tes informations de compte aident à accélérer les prochains passages à la caisse.",
          "Le support peut t’aider si tu n’arrives plus à accéder au compte.",
        ],
        ctaLabel: "Ouvrir mon compte",
        ctaHref: "/account",
      },
      {
        id: "conditions",
        eyebrow: "Conditions",
        title: "Conditions de vente, version claire",
        body: `${business.brand} est une boutique animalière locale avec livraison à domicile à Rimouski et support humain. Les commandes sont soumises à la disponibilité des produits et aux options de livraison offertes à l’adresse fournie.`,
        points: [
          "Les descriptions, prix et disponibilités peuvent être corrigés en cas d’erreur évidente avant l’exécution de la commande.",
          "La livraison dépend de l’adresse, de la zone desservie et des créneaux disponibles.",
          `Pour toute question liée à une commande, un paiement ou une livraison, écris à ${business.supportEmail}.`,
        ],
      },
    ];
  }

  return [
    {
      id: "livraison",
      eyebrow: "Delivery",
      title: "Home delivery in Rimouski",
      body: "Chez Olive is a local pet boutique with home delivery in Rimouski and nearby areas. Your address is checked in cart and checkout to confirm the available options.",
      points: [
        business.shippingPolicy,
        "Fees, taxes, and the final total are shown before confirmation.",
        "Available slots may vary depending on the area, route load, and products.",
      ],
      ctaLabel: "Shop with delivery",
      ctaHref: "/boutique",
    },
    {
      id: "commandes",
      eyebrow: "Orders",
      title: "Orders and tracking",
      body: "Your account keeps previous orders, statuses, and important details together. You also receive a confirmation email after checkout.",
      points: [
        "Tracking is available in My account, under My orders.",
        "To change an address or note, message us quickly before preparation.",
        "If an order needs manual validation, the team will contact you.",
      ],
      ctaLabel: "View my orders",
      ctaHref: "/account/orders",
    },
    {
      id: "paiement",
      eyebrow: "Payment",
      title: "Clear payment before confirmation",
      body: "The available payment method is shown at checkout. Depending on the order, payment may use Stripe or be handled manually.",
      points: [
        "Prices are in Canadian dollars.",
        "Subtotal, delivery, GST, QST, and the final total are visible before confirmation.",
        "No amount changes are hidden after validation.",
      ],
    },
    {
      id: "retours",
      eyebrow: "Returns",
      title: "Return, exchange, or issue",
      body: "If an item arrives damaged, does not match the order, or is not right, contact the team. We will validate the best next step with you.",
      points: [
        "Returns must be requested within 14 days of receiving the order.",
        "Items must be unused and in their original packaging, except for defects or order errors.",
        "A photo can help us process a damaged item faster.",
      ],
      ctaLabel: "Message us about a return",
      ctaHref: `mailto:${business.supportEmail}`,
    },
    {
      id: "compte",
      eyebrow: "Account",
      title: "My Chez Olive",
      body: "Your customer area keeps orders, addresses, and useful information together for easier future visits.",
      points: [
        "You can view order history and delivery details.",
        "Your account information helps speed up future checkouts.",
        "Support can help if you cannot access your account anymore.",
      ],
      ctaLabel: "Open my account",
      ctaHref: "/account",
    },
    {
      id: "conditions",
      eyebrow: "Terms",
      title: "Terms of sale, clearly",
      body: `${business.brand} is a local pet boutique with home delivery in Rimouski and human support. Orders are subject to product availability and the delivery options offered for the provided address.`,
      points: [
        "Descriptions, prices, and availability may be corrected before fulfillment if there is an obvious error.",
        "Delivery depends on the address, service area, and available slots.",
        `For any question about an order, payment, or delivery, email ${business.supportEmail}.`,
      ],
    },
  ];
}

export function getHelpCenterCards(language: Language, business: BusinessInfo): HelpCard[] {
  const supportDescription =
    language === "fr"
      ? `${business.supportEmail} - ${business.supportHours}`
      : `${business.supportEmail} - ${business.supportHours}`;

  if (language === "fr") {
    return [
      {
        title: "Livraison à domicile",
        description: "Livraison à domicile, zone desservie, frais, seuil gratuit et planification.",
        href: "/faq#livraison",
      },
      {
        title: "Commandes",
        description: "Suivi, confirmation et aide après achat.",
        href: "/faq#commandes",
      },
      {
        title: "Retours et problèmes",
        description: "Conditions, délai et procédure de contact.",
        href: "/faq#retours",
      },
      {
        title: "Conditions de vente",
        description: "Version courte et claire des règles qui encadrent la commande.",
        href: "/faq#conditions",
      },
      {
        title: "Nous joindre",
        description: supportDescription,
        href: `mailto:${business.supportEmail}`,
        external: true,
      },
    ];
  }

  return [
    {
      title: "Home delivery",
      description: "Home delivery area, fees, free threshold, and scheduling details.",
      href: "/faq#livraison",
    },
    {
      title: "Orders",
      description: "Tracking, confirmation, and after-purchase help.",
      href: "/faq#commandes",
    },
    {
      title: "Returns and issues",
      description: "Conditions, timing, and how to contact us.",
      href: "/faq#retours",
    },
    {
      title: "Terms",
      description: "A short, clear version of the rules that apply to an order.",
      href: "/faq#conditions",
    },
    {
      title: "Contact us",
      description: supportDescription,
      href: `mailto:${business.supportEmail}`,
      external: true,
    },
  ];
}

export function getHelpCenterQuestions(language: Language, business: BusinessInfo): HelpQuestion[] {
  if (language === "fr") {
    return [
      {
        topicId: "commandes",
        q: "Comment suivre ma commande ?",
        a: "Depuis Mon compte, tu peux consulter l’historique et le détail de ta commande. Tu reçois aussi un courriel de confirmation après l’achat.",
      },
      {
        topicId: "livraison",
        q: "Où livrez-vous ?",
        a: "Chez Olive offre la livraison à domicile à Rimouski et dans les environs. Le passage à la caisse confirme si l’adresse entre bien dans notre zone locale.",
      },
      {
        topicId: "paiement",
        q: "Quels modes de paiement sont acceptés ?",
        a: "Selon la commande, le paiement peut se faire avec Stripe ou en mode manuel. Le mode disponible est toujours affiché clairement au passage à la caisse.",
      },
      {
        topicId: "paiement",
        q: "Où voir les frais, les taxes et le total ?",
        a: "Le passage à la caisse affiche le sous-total, la livraison, le total avant taxes, la TPS, la TVQ et le total final avant de confirmer la commande.",
      },
      {
        topicId: "retours",
        q: "Que faire si j’ai un problème avec ma commande ?",
        a: `Ouvre la bulle Aide ou écris-nous à ${business.supportEmail}. On pourra t’aider pour une commande, une livraison ou un retour.`,
      },
    ];
  }

  return [
    {
      topicId: "commandes",
      q: "How do I track my order?",
      a: "From My account you can view your order history and order details. You also receive a confirmation email after checkout.",
    },
    {
      topicId: "livraison",
      q: "Where do you deliver?",
      a: "Chez Olive offers home delivery in Rimouski and nearby areas. Checkout confirms whether your address is inside our home delivery zone.",
    },
    {
      topicId: "paiement",
      q: "Which payment methods are accepted?",
      a: "Depending on the order, payment may be made with Stripe or through manual payment. The available option is always shown clearly at checkout.",
    },
    {
      topicId: "paiement",
      q: "Where can I see fees, taxes, and the final total?",
      a: "Checkout shows the subtotal, shipping, total before taxes, GST, QST, and final total before the order is confirmed.",
    },
    {
      topicId: "retours",
      q: "What should I do if there is a problem with my order?",
      a: `Open the Help bubble or email ${business.supportEmail}. We can help with an order, delivery, or return issue.`,
    },
  ];
}

export function getShippingSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Zone desservie",
        body: "La livraison à domicile est offerte surtout à Rimouski et dans les environs. L’adresse est validée au passage à la caisse pour confirmer si elle fait partie de la zone locale desservie.",
      },
      {
        title: "Délais et planification",
        body: "Les délais affichés sont estimatifs. Certaines commandes peuvent être planifiées manuellement si aucun créneau immédiat n’est disponible.",
      },
      {
        title: "Frais de livraison",
        body: business.shippingPolicy,
      },
      {
        title: "Avant de confirmer la commande",
        body: "Le passage à la caisse affiche toujours les frais de livraison, les taxes et le total final avant la confirmation. Tu peux donc valider clairement le montant à payer.",
      },
      {
        title: "Besoin d’aide ?",
        body: `Ouvre la bulle Aide ou écris-nous à ${business.supportEmail}.`,
      },
    ];
  }

  return [
    {
      title: "Delivery area",
      body: "Home delivery is mainly offered in Rimouski and nearby areas. The address is checked at checkout to confirm whether it is inside the local service zone.",
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
      body: `Open the Help bubble or email ${business.supportEmail}.`,
    },
  ];
}

export function getReturnsSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Demande de retour",
        body: "Tu peux demander un retour dans les 14 jours suivant la réception de la commande. La demande doit être validée par notre équipe avant le traitement final.",
      },
      {
        title: "Articles admissibles",
        body: "Les produits doivent être non utilisés et retournés dans leur emballage d’origine, avec tous les éléments inclus.",
      },
      {
        title: "Remboursement",
        body: "Lorsqu’un retour est accepté et reçu, le remboursement est généralement traité dans un délai de 5 à 10 jours ouvrables.",
      },
      {
        title: "Article défectueux ou problème de commande",
        body: "Si un article arrive endommagé, défectueux ou ne correspond pas à la commande, contacte-nous rapidement pour qu’on puisse corriger la situation.",
      },
      {
        title: "Contact retours",
        body: `Pour lancer une demande, ouvre la bulle Aide ou écris-nous à ${business.supportEmail}.`,
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
      body: `To start a request, open the Help bubble or email ${business.supportEmail}.`,
    },
  ];
}

export function getTermsSections(language: Language, business: BusinessInfo): HelpSection[] {
  if (language === "fr") {
    return [
      {
        title: "Commerçant",
        body: `${business.brand} est une boutique animalière locale avec livraison à domicile à Rimouski et support client à ${business.supportEmail}.`,
      },
      {
        title: "Commande et paiement",
        body: "Les commandes sont soumises à la disponibilité des produits. Le mode de paiement offert est affiché au passage à la caisse avant la confirmation.",
      },
      {
        title: "Prix et disponibilité",
        body: "Les prix sont affichés en dollars canadiens. Malgré le soin apporté au site, une erreur évidente de prix, de description ou de disponibilité peut être corrigée avant l’exécution de la commande.",
      },
      {
        title: "Livraison",
        body: "La livraison et sa planification dépendent de l’adresse, de la zone desservie et des disponibilités. Les frais applicables et le total sont affichés avant la confirmation.",
      },
      {
        title: "Retours",
        body: "Les retours et remboursements sont gérés dans le Centre d’aide, section Retours.",
      },
      {
        title: "Contact",
        body: `Pour toute question liée à une commande, un paiement ou une livraison, écris-nous à ${business.supportEmail}.`,
      },
    ];
  }

  return [
    {
      title: "Merchant",
      body: `${business.brand} is a local pet boutique with home delivery in Rimouski and customer support at ${business.supportEmail}.`,
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
      body: "Returns and refunds are handled in the Help center, Returns section.",
    },
    {
      title: "Contact",
      body: `For any question related to an order, payment, or delivery, email us at ${business.supportEmail}.`,
    },
  ];
}
