import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalSupportChat } from "@/components/GlobalSupportChat";
import { SiteFooter } from "@/components/SiteFooter";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "Chez Olive — Boutique animalière",
    template: "%s | Chez Olive",
  },
  description: "Boutique animalière bilingue, indépendante et fiable - Nourriture, jouets et accessoires premium pour animaux.",
  applicationName: "Chez Olive",
  keywords: [
    "boutique animale",
    "animalerie en ligne",
    "produits pour chiens",
    "accessoires pour animaux",
    "Chez Olive",
  ],
  creator: "Chez Olive",
  publisher: "Chez Olive",
  category: "ecommerce",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Chez Olive",
    title: "Chez Olive — Boutique animalière",
    description: "Boutique animalière bilingue, indépendante et fiable - Nourriture, jouets et accessoires premium pour animaux.",
    locale: "fr_CA",
    images: [
      {
        url: "/olive-logo-2.png",
        width: 1200,
        height: 630,
        alt: "Chez Olive",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chez Olive — Boutique animalière",
    description: "Boutique animalière bilingue, indépendante et fiable - Nourriture, jouets et accessoires premium pour animaux.",
    images: ["/olive-logo-2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
        <GlobalSupportChat />
      </body>
    </html>
  );
}

