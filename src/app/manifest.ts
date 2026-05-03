import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Chez Olive",
    short_name: "Chez Olive",
    description:
      "Boutique, compte client, chiens QR, support et livraison locale Chez Olive.",
    lang: "fr-CA",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait-primary",
    background_color: "#FBF7EF",
    theme_color: "#545D2E",
    categories: ["shopping", "lifestyle", "business"],
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Boutique",
        short_name: "Boutique",
        description: "Magasiner les produits Chez Olive.",
        url: "/boutique",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Support",
        short_name: "Support",
        description: "Ouvrir le support Chez Olive.",
        url: "/account/support",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Mes commandes",
        short_name: "Commandes",
        description: "Voir le suivi de mes commandes.",
        url: "/account/orders",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Tournée livreur",
        short_name: "Livreur",
        description: "Ouvrir l'espace chauffeur.",
        url: "/app#livreur",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
