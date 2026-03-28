import "react-native-url-polyfill/auto";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/lib/theme";
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
  });

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutInner fontsReady={fontsLoaded || !!error} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutInner({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading: authIsLoading } = useAuth();

  useEffect(() => {
    if (fontsReady && !authIsLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, authIsLoading]);

  if (!fontsReady || authIsLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
