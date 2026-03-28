import { colors } from "@/lib/theme";
import { Stack } from "expo-router";

export default function LibraryStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[topicId]"
        options={{
          headerShown: true,
          headerBackTitle: "",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
