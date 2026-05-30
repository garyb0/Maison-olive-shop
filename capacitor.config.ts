/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.CAPACITOR_SERVER_URL ?? "https://chezolive.ca";

const config: CapacitorConfig = {
  appId: "ca.chezolive.app",
  appName: "Chez Olive",
  webDir: "capacitor-www",
  server: {
    url: appUrl,
    appStartPath: "/app",
    errorPath: "offline.html",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: ["chezolive.ca", "www.chezolive.ca"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["sound", "alert"],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      launchFadeOutDuration: 180,
      backgroundColor: "#F7F3EA",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F3EA",
    },
  },
};

export default config;
