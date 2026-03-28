import { colors, radius, spacing, typography } from "@/lib/theme";
import { useState } from "react";
import { TextInput as RNTextInput, StyleSheet, View } from "react-native";
import type { TextInputProps as RNTextInputProps } from "react-native";

interface TextInputProps extends Omit<RNTextInputProps, "style"> {
  placeholder?: string;
  testID?: string;
}

/**
 * TextInput — surface-container-high background, ghost border focus state.
 * No bottom line. Focus ring uses primary at ~20% opacity per design spec.
 */
export function TextInput({ placeholder, testID, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, focused && styles.focused]}>
      <RNTextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={colors.outlineVariant}
        style={styles.input}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s4,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  focused: {
    // Ghost border: primary at ~20% opacity (#536253 + 33 = 20% alpha)
    borderColor: `${colors.primary}33`,
  },
  input: {
    ...typography.bodyLg,
    color: colors.onSurface,
    padding: 0,
  },
});
