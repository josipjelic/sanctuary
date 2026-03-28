import { colors, radius, spacing, typography } from "@/lib/theme";
import { StyleSheet, Text, View } from "react-native";

interface TagProps {
  label: string;
  testID?: string;
}

/**
 * Tag — displays an AI-assigned or manually edited thought tag.
 * Uses surfaceContainerLow background with secondary text color.
 */
export function Tag({ label, testID }: TagProps) {
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
