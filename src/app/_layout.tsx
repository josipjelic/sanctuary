import "react-native-url-polyfill/auto";
import { AuthProvider } from "@/contexts/AuthContext";
import {
  OnboardingProvider,
  useOnboardingContext,
} from "@/contexts/OnboardingContext";
import { useAuth } from "@/hooks/useAuth";
import { prefetchNotificationHandler } from "@/lib/notifications";
import { checkOnboardingComplete } from "@/lib/oceanOnboarding";
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
  useEffect(() => {
    prefetchNotificationHandler();
  }, []);

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
        <OnboardingProvider>
          <RootLayoutInner fontsReady={fontsLoaded || !!error} />
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutInner({ fontsReady }: { fontsReady: boolean }) {
  const { session, isLoading: authIsLoading } = useAuth();
  const { onboardingChecked, setCheckedState } = useOnboardingContext();

  useEffect(() => {
    if (authIsLoading) return;

    if (!session) {
      setCheckedState(true, false);
      return;
    }

    checkOnboardingComplete(session.user.id).then((complete) => {
      setCheckedState(true, complete);
    });
  }, [session, authIsLoading, setCheckedState]);

  const isReady = fontsReady && !authIsLoading && onboardingChecked;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
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
