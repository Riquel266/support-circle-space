import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cuidarbem.app",
  appName: "CuidarBem",
  webDir: "dist-web",
  server: {
    androidScheme: "https",
    allowNavigation: ["*"],
  },
  plugins: {
    Geolocation: {
      androidPermissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },
  },
};

export default config;
