import { useAuth } from "@/hooks/useAuth";
import { colors, typography } from "@/lib/theme";
import { MaterialIcons } from "@expo/vector-icons";
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
      <Tabs.Screen
        name="index"
        options={{
          title: "Capture",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialIcons
              name={focused ? "home-filled" : "home"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Thoughts",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="all-inbox" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="subscriptions" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
