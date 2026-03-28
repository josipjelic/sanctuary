// TODO: Replace with main capture screen in task #006
import { Button } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { colors, spacing, typography } from "@/lib/theme";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sanctuary</Text>
        <Text style={styles.subtitle}>Your thoughts, organised.</Text>
      </View>
      <View style={styles.footer}>
        <Button label="Log Out" onPress={signOut} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s2,
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
  },
  footer: {
    paddingHorizontal: spacing.s6,
    paddingBottom: spacing.s6,
  },
});
