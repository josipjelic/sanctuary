import { colors, radius, spacing, typography } from "@/lib/theme";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import type { ViewStyle } from "react-native";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
  testID,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
      testID={testID}
    >
      <Text style={[styles.label, styles[`${variant}Label` as const]]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondaryContainer,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  primaryLabel: {
    color: colors.onPrimary,
  },
  secondaryLabel: {
    color: colors.onSecondaryContainer,
  },
});
