import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { Footer } from "@/components/layout/footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://flota-camiones.com'),
  title: {
    default: "Flota Camiones — Gestión Inteligente de Flota",
    template: "%s | Flota Camiones",
  },
  description:
    "Sistema integral de gestión de flota de camiones en España. Controlá ingresos, gastos, trabajadores y nóminas con deducciones españolas (IRPF, Seguridad Social).",
  keywords: [
    "gestión de flota de camiones",
    "software trucking España",
    "control de flotas transporte",
    "gestión ingresos gastos camiones",
    "nóminas transportistas",
    "software transporte mercancías",
    "flota vehículos pesada",
    "ERP transporte",
    "gestión transportistas",
    "camiones España",
  ],
  authors: [{ name: "Flota Camiones", url: "https://flota-camiones.com" }],
  creator: "Flota Camiones",
  publisher: "Flota Camiones",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flota Camiones",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://flota-camiones.com",
    siteName: "Flota Camiones",
    title: "Flota Camiones — Gestión Inteligente de Flota de Camiones",
    description:
      "Sistema integral de gestión de flota de camiones en España. Controlá ingresos, gastos, trabajadores y nóminas desde una sola plataforma.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flota Camiones - Gestión de Flota de Camiones",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flota Camiones — Gestión Inteligente de Flota",
    description:
      "Sistema integral de gestión de flota de camiones. Controlá ingresos, gastos, trabajadores y nóminas.",
    creator: "@flotacamiones",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://flota-camiones.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans flex flex-col">
        {children}
        <Footer />
        <OfflineBanner />
        <InstallPrompt />
      </body>
    </html>
  );
}
