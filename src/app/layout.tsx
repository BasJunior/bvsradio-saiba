import type { Metadata, Viewport } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VisitorAssistant from "@/components/VisitorAssistant";
import PwaRegister from "@/components/PwaRegister";
import Link from "next/link";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BVS Radio | Best Virtual Sound",
    template: "%s | BVS Radio",
  },
  description:
    "BVS Radio (Best Virtual Sound) — Zimbabwe's online radio. Stream music, explore the catalogue, and enjoy BVS on phone, tablet, or desktop.",
  applicationName: "BVS Radio",
  appleWebApp: {
    capable: true,
    title: "BVS Radio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "BVS Radio",
    title: "BVS Radio | Best Virtual Sound",
    description: "Listen to BVS Radio anywhere — live rotation, catalogue, and culture.",
    images: [{ url: "/logo.png", width: 1024, height: 1024, alt: "BVS Radio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BVS Radio",
    description: "Zimbabwe's Best Virtual Sound — listen on mobile or web.",
    images: ["/logo.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary min-h-screen font-sans">
        <Navbar />
        <main className="pt-16 pb-24 sm:pb-16">{children}</main>
        <Footer />
        <VisitorAssistant />
        <PwaRegister />

        <Link
          href="/radio"
          className="fixed bottom-6 left-4 z-50 group flex items-center gap-2 bg-brand hover:bg-brand-dark text-black font-medium px-5 py-2.5 rounded-full text-sm tracking-[-0.01em] transition-all sm:left-6"
        >
          Listen
          <span className="opacity-60 group-hover:translate-x-0.5 transition">→</span>
        </Link>
      </body>
    </html>
  );
}
