export default ({ config }) => ({
  ...config,
  name: "Cruzza",
  slug: "cruzza-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "cruzza",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#4f46e5"
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.cruzza.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Cruzza needs your location to find nearby drivers and track your ride.",
      NSLocationAlwaysUsageDescription:
        "Cruzza needs your location to track your ride even when the app is in the background.",
      UIBackgroundModes: ["location", "fetch"]
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#4f46e5"
    },
    package: "com.cruzza.app",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "POST_NOTIFICATIONS"
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    }
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Cruzza needs your location to find nearby drivers and track your ride.",
        locationAlwaysPermission:
          "Cruzza needs your location to track your ride even when the app is in the background.",
        locationWhenInUsePermission:
          "Cruzza needs your location to find nearby drivers and track your ride."
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#4f46e5"
      }
    ],
    "expo-font"
  ],
  extra: {
    eas: {
      projectId: "b117fea8-1b27-4e46-aca4-69329e1f94b1"
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
});
