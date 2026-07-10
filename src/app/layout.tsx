import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BVS Radio – Zimbabwe's Online Radio Station",
  description: "Zimbabwe's premier online radio station. Hip-hop, trap, afrobeats, and more from across Africa.",
  keywords: "Zimbabwe radio, online radio, hip-hop, afrobeats, BVS Radio, African music",
  openGraph: {
    title: "BVS Radio",
    description: "Zimbabwe's premier online radio station",
    type: "website",
    url: "https://bvsradio.com",
  },
};

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}