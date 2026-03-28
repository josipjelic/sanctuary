import { colors, radius, spacing, typography } from "@/lib/theme";
import { StyleSheet, Text, View } from "react-native";

interface TopicProps {
  label: string;
  testID?: string;
}

/**
 * Topic — displays the AI-assigned primary topic for a thought.
 */
export function Topic({ label, testID }: TopicProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    alignSelf: "flex-start",
  },
  label: {
    ...typography.labelMd,
    color: colors.secondary,
  },
});
