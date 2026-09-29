module.exports = ({ config }) => ({
  ...config,
  name: "ATENZA",
  scheme: "atenza",
  orientation: "default",
  userInterfaceStyle: "light",
  android: { ...config.android, package: "com.superteam.atenza" },
  ios: { ...config.ios, bundleIdentifier: "com.superteam.atenza" },
  plugins: [
    "expo-router",
    "@react-native-tvos/config-tv",
  ],
});
