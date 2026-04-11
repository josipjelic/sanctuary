import { useAuth } from "@/hooks/useAuth";
import { Redirect, Stack } from "expo-router";

export default function OnboardingLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
