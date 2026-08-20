import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for App Store / Play Store.
 * Loads the live site so content updates deploy with Vercel (no store resubmit for catalogue).
 * For fully offline packages later: switch to local `webDir` after a static export strategy.
 */
const mobileSurface = process.env.BVS_MOBILE_SURFACE === "android" ? "android" : "ios";
const appVariant = process.env.BVS_APP_VARIANT === "beta" ? "beta" : "production";
const isBeta = appVariant === "beta";
const betaUrl = process.env.BVS_MOBILE_URL?.trim();

if (isBeta && !betaUrl) {
  throw new Error(
    "BVS_MOBILE_URL is required for beta builds. Point it at the isolated staging deployment.",
  );
}

const serverUrl = new URL(
  isBeta ? betaUrl! : `https://bvsradio.com/app/${mobileSurface}`,
);

if (serverUrl.protocol !== "https:") {
  throw new Error("BVS mobile builds require an HTTPS server URL.");
}

const config: CapacitorConfig = {
  appId: isBeta ? "com.bvsradio.beta" : "com.bvsradio.app",
  appName: isBeta ? "BVS Radio Beta" : "BVS Radio",
  webDir: "out",
  server: {
    // Live hybrid: always serve production web app inside the native shell
    // Default build is iOS. Play builds use BVS_MOBILE_SURFACE=android.
    url: serverUrl.toString(),
    cleartext: false,
    allowNavigation: isBeta
      ? [serverUrl.hostname, `https://${serverUrl.hostname}/*`]
      : ["bvsradio.com", "*.bvsradio.com", "https://bvsradio.com/*"],
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
    path: isBeta ? "ios-beta" : "ios",
    backgroundColor: "#0A0A0A",
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
