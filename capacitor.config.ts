import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for App Store / Play Store.
 * Loads the live site so content updates deploy with Vercel (no store resubmit for catalogue).
 * For fully offline packages later: switch to local `webDir` after a static export strategy.
 */
const mobileSurface = process.env.BVS_MOBILE_SURFACE === "android" ? "android" : "ios";

const config: CapacitorConfig = {
  appId: "com.bvsradio.app",
  appName: "BVS Radio",
  webDir: "out",
  server: {
    // Live hybrid: always serve production web app inside the native shell
    // Default build is iOS. Play builds use BVS_MOBILE_SURFACE=android.
    url: `https://bvsradio.com/app/${mobileSurface}`,
    cleartext: false,
    allowNavigation: [
      "bvsradio.com",
      "*.bvsradio.com",
      "https://bvsradio.com/*",
    ],
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
