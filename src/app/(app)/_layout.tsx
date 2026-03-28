import { useAuth } from "@/hooks/useAuth";
import { colors, typography } from "@/lib/theme";
import { Redirect, Tabs } from "expo-router";

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarLabelStyle: {
          ...typography.labelMd,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Capture" }} />
      <Tabs.Screen name="inbox" options={{ title: "Thoughts" }} />
    </Tabs>
  );
}
