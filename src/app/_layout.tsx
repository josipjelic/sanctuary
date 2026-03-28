import "react-native-url-polyfill/auto";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/useAuth";
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
    <AuthProvider>
      <RootLayoutInner fontsReady={fontsLoaded || !!error} />
    </AuthProvider>
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
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
