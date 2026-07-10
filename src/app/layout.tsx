import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// Google AdSense
const ADSENSE_CLIENT = "ca-pub-9667714563110814";

export const metadata: Metadata = {
  title: {
    default: "BVS Radio – Zimbabwe's Online Radio Station",
    template: "%s | BVS Radio",
  },
  description:
    "Zimbabwe's premier online radio station. Hip-hop, trap, afrobeats, and more from across Africa. Listen live 24/7.",
  keywords:
    "Zimbabwe radio, online radio, hip-hop, afrobeats, BVS Radio, African music, live streaming",
  openGraph: {
    title: "BVS Radio",
    description: "Zimbabwe's premier online radio station",
    type: "website",
    url: "https://bvsradio.com",
    siteName: "BVS Radio",
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-BVSRADIO"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-BVSRADIO');
            `,
          }}
        />
        {/* Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased font-sans">
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}