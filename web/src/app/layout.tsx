import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { OfflineSync } from "@/components/OfflineSync";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KiranaReach — Hyperlocal quick commerce",
  description:
    "Offline-first marketplace connecting neighborhood stores with customers and delivery partners.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <OfflineSync />
        {children}
      </body>
    </html>
  );
}
