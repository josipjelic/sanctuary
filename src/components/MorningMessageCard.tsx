import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface MorningMessageCardProps {
  onDismiss: () => void;
  messageText?: string;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function MorningMessageCard({
  onDismiss,
  messageText,
  isLoading,
  hasError,
  onRetry,
}: MorningMessageCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const dismissAnim = useRef(new Animated.Value(0)).current;
  const dismissOpacity = useRef(new Animated.Value(1)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.4)).current;
  const shimmerAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!isLoading) {
      shimmerAnimation.current?.stop();
      shimmerOpacity.setValue(1);
      return;
    }

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        shimmerOpacity.setValue(0.6);
        return;
      }
      shimmerAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      shimmerAnimation.current.start();
    });

    return () => {
      shimmerAnimation.current?.stop();
    };
  }, [isLoading, shimmerOpacity]);

  function handleDismiss() {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDismissed(true);
        onDismiss();
        return;
      }

      Animated.parallel([
        Animated.timing(dismissAnim, {
          toValue: -24,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(dismissOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDismissed(true);
        onDismiss();
      });
    });
  }

  if (dismissed) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: dismissAnim }],
          opacity: dismissOpacity,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel="Your morning message"
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <Text style={styles.label}>This morning</Text>
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.dismissButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss morning message"
          testID="morning-message-dismiss"
        >
          <Ionicons
            name="close-outline"
            size={18}
            color={colors.outlineVariant}
          />
        </Pressable>
      </View>

      {/* Body */}
      {isLoading ? (
        <View
          accessibilityLabel="Loading your morning message"
          accessibilityLiveRegion="polite"
        >
          <Animated.View
            style={[
              styles.skeletonBar,
              styles.skeletonBarWide,
              { opacity: shimmerOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonBar,
              styles.skeletonBarMid,
              { opacity: shimmerOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonBar,
              styles.skeletonBarNarrow,
              { opacity: shimmerOpacity },
            ]}
          />
          <Animated.View
            style={[styles.skeletonAccent, { opacity: shimmerOpacity }]}
          />
        </View>
      ) : hasError ? (
        <View accessibilityRole="alert">
          <Text style={styles.errorText}>
            Your morning message couldn't load.
          </Text>
          <Pressable
            onPress={onRetry}
            style={styles.retryRow}
            accessibilityRole="button"
            accessibilityLabel="Retry loading morning message"
            testID="morning-message-retry"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text
            style={styles.messageText}
            accessibilityRole="text"
            testID="morning-message-text"
          >
            {messageText ?? ""}
          </Text>
          <View style={styles.accentBar} />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.s6,
    marginHorizontal: spacing.s8,
    marginTop: spacing.s4,
    marginBottom: spacing.s6,
    minHeight: 80,
    ...shadows.card,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.s4,
  },
  label: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    letterSpacing: 0.5,
  },
  dismissButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  messageText: {
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 26,
  },
  accentBar: {
    height: 2,
    width: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    marginTop: spacing.s4,
  },
  skeletonBar: {
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: 8,
  },
  skeletonBarWide: {
    width: "90%",
  },
  skeletonBarMid: {
    width: "75%",
  },
  skeletonBarNarrow: {
    width: "60%",
  },
  skeletonAccent: {
    width: 40,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    marginTop: spacing.s4,
  },
  errorText: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
  },
  retryRow: {
    paddingVertical: spacing.s4,
    marginTop: spacing.s2,
  },
  retryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
});
