import { colors, radius, shadows } from "@/lib/theme";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";

type CardSize = "lg" | "xl";
type CardVariant = "elevated" | "flat";

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Card — no border lines. Separation is achieved through background color
 * shifts (surfaceContainerLowest on a surfaceContainerLow background).
 * Shape: xl (32pt) or lg (24pt) corner radius per design spec.
 */
export function Card({
  children,
  variant = "elevated",
  size = "lg",
  style,
  testID,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        styles[size],
        variant === "elevated" && shadows.card,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  lg: {
    borderRadius: radius.lg,
  },
  xl: {
    borderRadius: radius.xl,
  },
});
