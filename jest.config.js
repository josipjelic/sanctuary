module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^https://esm\\.sh/luxon@3\\.5\\.0$": "luxon",
    "^https://esm\\.sh/@supabase/supabase-js@2\\.49\\.4$":
      "@supabase/supabase-js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|((jest-)?react-native|@react-native(-community)?|@react-native/.*)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))",
  ],
};
