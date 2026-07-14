import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BVS Radio | Best Virtual Sound — Zimbabwe's Sound • Live • Culture • Community",
  description: "BVS Radio (Best Virtual Sound) — Zimbabwe's premier online radio station. Stream live 24/7, discover African music, access pro services (mixing, mastering, beats, presets, distribution), upload your tracks, and connect with the community.",
  icons: {
    icon: "/assets/images/Bvsradio_logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary min-h-screen font-sans">
        <Navbar />
        <main className="pt-16">
          {children}
        </main>
        <Footer />

        {/* Floating Listen Button - clean premium style */}
        <Link
          href="/radio"
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 bg-brand hover:bg-brand-dark text-black font-medium px-6 py-2.5 rounded-full text-sm tracking-[-0.01em] transition-all"
        >
          Listen
          <span className="opacity-60 group-hover:translate-x-0.5 transition">→</span>
        </Link>
      </body>
    </html>
  );
}
