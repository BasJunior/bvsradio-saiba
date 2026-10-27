import ShareCardHost from "@/components/layout/ShareCardHost";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { RootNavbar, RootMobileFlowNav } from "@/components/layout/RootChrome";
import Footer from "@/components/layout/Footer";
import AuthLinkRescue from "@/components/AuthLinkRescue";
import AnalyticsBootstrap from "@/components/AnalyticsBootstrap";
import Ga4WebTag from "@/components/Ga4WebTag";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import MobileIosBoundary from "@/components/MobileIosBoundary";
import PremiumInstantPromoBanner from "@/components/PremiumInstantPromoBanner";
import { PersistentPlayer, StationPlayerProvider } from "@/components/StationPlayer";
import SharedProgrammeExitNormalizer from "@/components/SharedProgrammeExitNormalizer";
import NowPlayingSwipeGestures from "@/components/NowPlayingSwipeGestures";
import { LibrarySyncProvider } from "@/components/LibrarySyncProvider";
import FlowNavigationProvider from "@/components/flow/FlowNavigationProvider";
import AppSurfaceProvider from "@/components/app/AppSurfaceProvider";
import BvsSectionScope from "@/components/layout/BvsSectionScope";
import DeferredEditorialTools from "@/components/layout/DeferredEditorialTools";
import DeferredGlobalTools from "@/components/layout/DeferredGlobalTools";
import "./globals.css";
import "./section-accents.css";
import "./brand-culture.css";
import "./creator-bands.css";

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
    icon: [{ url: "/branding/bvs-monogram-v2.svg", sizes: "any", type: "image/svg+xml" }],
    shortcut: [{ url: "/branding/bvs-monogram-v2.svg", type: "image/svg+xml" }],
    apple: [{ url: "/branding/bvs-monogram-v2.svg", sizes: "any", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "BVS Radio",
    title: "BVS Radio | Best Virtual Sound",
    description: "Listen to BVS Radio anywhere — live rotation, catalogue, and culture.",
    images: [{ url: "/branding/bvs-share-logo.png", alt: "BVS Radio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BVS Radio",
    description: "Best Virtual Sound — studio music rooted in Zimbabwe, on mobile or web.",
    images: ["/branding/bvs-share-logo.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: "dark" }}>
      <body className="bg-bg-primary text-text-primary min-h-screen font-sans">
        <LibrarySyncProvider>
          <StationPlayerProvider tracks={[]}>
            <AppSurfaceProvider>
              <MobileIosBoundary />
              <FlowNavigationProvider>
                <RootNavbar />
                <AuthLinkRescue />
                <main className="bvs-page-main pt-16 pb-44 md:pb-28">
                  <PremiumInstantPromoBanner />
                  <DeferredEditorialTools />
                  <BvsSectionScope>{children}</BvsSectionScope>
                </main>
                <Footer />
                <div className="bvs-app-bottom-spacer" aria-hidden="true" />
                <DeferredGlobalTools />
                <ShareCardHost />
                <AnalyticsBootstrap />
                <Ga4WebTag />
                <WebVitalsReporter />
                <Suspense fallback={null}>
                  <RootMobileFlowNav />
                </Suspense>
                <SharedProgrammeExitNormalizer />
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
