import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for App Store / Play Store.
 * Loads the dedicated mobile surface on the live BVS origin.
 *
 * Build 3 deliberately defines no extra allowNavigation hosts. The WebView is
 * rooted at server.url, while same-origin paths outside /app/ios are handled by
 * the in-app MobileIosBoundary and opened externally rather than becoming app
 * catalogue surfaces.
 */
const mobileSurface = process.env.BVS_MOBILE_SURFACE === "android" ? "android" : "ios";

const config: CapacitorConfig = {
  appId: "com.bvsradio.app",
  appName: "BVS Radio",
  webDir: "out",
  server: {
    url: `https://bvsradio.com/app/${mobileSurface}`,
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0A0A0A",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0A0A0A",
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0A0A0A",
  },
  ios: {
    backgroundColor: "#0A0A0A",
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
