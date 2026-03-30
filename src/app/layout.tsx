import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalSupportChat } from "@/components/GlobalSupportChat";
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
  title: "Maison d'Olive — Boutique Animalière",
  description: "Boutique animalière bilingue, indépendante et fiable - Nourriture, jouets et accessoires premium pour animaux.",
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
        <GlobalSupportChat />
      </body>
    </html>
  );
}
