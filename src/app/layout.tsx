import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { Viewport } from "next";
import { GlobalSupportChat } from "@/components/GlobalSupportChat";
import { NativeAppChrome } from "@/components/NativeAppChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { env } from "@/lib/env";
import "./globals.css";

const nativeAppBootstrap = `
(() => {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const capacitor = window.Capacitor;
  const isNative = Boolean(capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform());
  const isPreview = params.get("native") === "1" && (host === "localhost" || host === "127.0.0.1" || host === "::1");
  if (!isNative && !isPreview) return;

  const hasClientChrome = !/^\\/(admin|driver|dog)(\\/|$)/.test(window.location.pathname);
  const apply = () => {
    document.documentElement.classList.add("is-capacitor-native");
    document.documentElement.dataset.nativeApp = "chezolive";
    document.documentElement.classList.toggle("has-native-client-chrome", hasClientChrome);
    if (!document.body) return;
    document.body.classList.add("is-capacitor-native");
    document.body.dataset.nativeApp = "chezolive";
    document.body.classList.toggle("has-native-client-chrome", hasClientChrome);
  };

  apply();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  }

  try {
    const plugins = capacitor && capacitor.Plugins ? capacitor.Plugins : {};
    if (isNative && plugins.SplashScreen && typeof plugins.SplashScreen.hide === "function") {
      plugins.SplashScreen.hide();
    }
  } catch {
  }
})();
`;

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
  manifest: "/manifest.webmanifest",
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
  appleWebApp: {
    capable: true,
    title: "Chez Olive",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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

export const viewport: Viewport = {
  themeColor: "#545D2E",
  colorScheme: "light",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: nativeAppBootstrap }} />
        <NativeAppChrome />
        {children}
        <SiteFooter />
        <GlobalSupportChat />
      </body>
    </html>
  );
}

