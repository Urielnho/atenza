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
    ...(process.env.EXPO_TV === "1"
      ? []
      : [
          [
            "expo-local-authentication",
            {
              faceIDPermission:
                "ATENZA usa Face ID para autorizar tu registro de asistencia.",
            },
          ],
        ]),
  ],
});
