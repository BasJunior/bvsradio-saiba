import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VisitorAssistant from "@/components/VisitorAssistant";
import PwaRegister from "@/components/PwaRegister";
import AuthLinkRescue from "@/components/AuthLinkRescue";
import ClientErrorBeacon from "@/components/ClientErrorBeacon";
import MobileIosBoundary from "@/components/MobileIosBoundary";
import { PersistentPlayer, StationPlayerProvider } from "@/components/StationPlayer";
import NowPlayingSwipeGestures from "@/components/NowPlayingSwipeGestures";
import { LibrarySyncProvider } from "@/components/LibrarySyncProvider";
import FlowNavigationProvider from "@/components/flow/FlowNavigationProvider";
import AppSurfaceProvider from "@/components/app/AppSurfaceProvider";
import MobileFlowNav from "@/components/layout/MobileFlowNav";
import "./globals.css";

const defaultSiteUrl = "https://bvsradio.com";
const siteUrl = (() => {
  const value = process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl;
  try {
    return new URL(value).origin;
  } catch {
    return defaultSiteUrl;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BVS Radio | Best Virtual Sound",
    template: "%s | BVS Radio",
  },
  description:
    "BVS Radio (Best Virtual Sound) — international online radio rooted in Zimbabwe. Stream music, explore the catalogue, and enjoy BVS on phone, tablet, or desktop.",
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
      { url: "/favicon-v2.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/bvs-favicon-v2-48.png", sizes: "48x48", type: "image/png" },
      { url: "/bvs-icon-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/bvs-icon-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-v2.ico", type: "image/x-icon" }],
    apple: [{ url: "/bvs-apple-touch-v2.png", sizes: "180x180", type: "image/png" }],
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
    description: "Best Virtual Sound — studio music rooted in Zimbabwe, on mobile or web.",
    images: ["/logo.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#F6F4EF" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const t=localStorage.getItem('bvs_theme');const v=t==='light'||t==='dark'?t:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v}catch(e){}` }} />
      </head>
      <body className="bg-bg-primary text-text-primary min-h-screen font-sans">
        <LibrarySyncProvider>
          <StationPlayerProvider tracks={[]}>
            <AppSurfaceProvider>
              <MobileIosBoundary />
              <FlowNavigationProvider>
                <Navbar />
                <AuthLinkRescue />
                <main className="bvs-page-main pt-16 pb-44 md:pb-28">{children}</main>
                <Footer />
                <div className="bvs-app-bottom-spacer" aria-hidden="true" />
                <VisitorAssistant />
                <PwaRegister />
                <ClientErrorBeacon />
                <Suspense fallback={null}>
                  <MobileFlowNav />
                </Suspense>
                <PersistentPlayer />
                <NowPlayingSwipeGestures />
              </FlowNavigationProvider>
            </AppSurfaceProvider>
          </StationPlayerProvider>
        </LibrarySyncProvider>
      </body>
    </html>
  );
}
