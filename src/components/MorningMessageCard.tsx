import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface MorningMessageCardProps {
  visible: boolean;
  onDismiss: () => void;
  onRegenerate: () => void;
  messageText?: string;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function MorningMessageCard({
  visible,
  onDismiss,
  onRegenerate,
  messageText,
  isLoading,
  hasError,
  onRetry,
}: MorningMessageCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.4)).current;
  const shimmerAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        fadeAnim.setValue(1);
        return;
      }
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    });
  }, [visible, fadeAnim]);

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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <LinearGradient
        colors={[colors.primaryContainer, colors.surface]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
              <View style={styles.brandRow}>
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons
                    name="spa-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.brandMark} accessibilityLabel="Sanctuary">
                  sanctuary
                </Text>
              </View>

              <Text style={styles.timeLabel}>This morning</Text>

              <View style={styles.messageArea} accessibilityLiveRegion="polite">
                {isLoading ? (
                  <View accessibilityLabel="Loading your morning message">
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
                        styles.skeletonBarFull,
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
                  <Text
                    style={styles.messageText}
                    accessibilityRole="text"
                    testID="morning-message-text"
                  >
                    {messageText ?? ""}
                  </Text>
                )}
              </View>

              <View style={styles.accentBar} />

              <TouchableOpacity
                onPress={onDismiss}
                style={styles.ctaButton}
                accessibilityRole="button"
                accessibilityLabel="Continue my day"
                testID="morning-message-continue"
                activeOpacity={0.88}
              >
                <Text style={styles.ctaLabel}>Continue my day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onRegenerate}
                disabled={isLoading}
                style={[
                  styles.regenerateButton,
                  isLoading && styles.regenerateButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Regenerate my morning message"
                testID="morning-message-regenerate"
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={colors.outlineVariant}
                />
                <Text style={styles.regenerateLabel}>
                  Regenerate my morning message
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s12,
    justifyContent: "center",
  },
  inner: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.s20,
    marginBottom: spacing.s12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMark: {
    ...typography.labelMd,
    color: colors.primary,
    letterSpacing: 4,
    fontSize: 13,
  },
  timeLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    letterSpacing: 1,
    marginBottom: spacing.s6,
    textTransform: "uppercase",
    fontSize: 11,
  },
  messageArea: {
    marginBottom: spacing.s8,
  },
  messageText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 24,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.onSurface,
  },
  accentBar: {
    height: 2,
    width: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    marginBottom: spacing.s16,
  },
  ctaButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  ctaLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    color: colors.onPrimary,
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    marginTop: spacing.s2,
  },
  regenerateButtonDisabled: {
    opacity: 0.4,
  },
  regenerateLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.outlineVariant,
  },
  skeletonBar: {
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary}20`,
    marginBottom: 14,
  },
  skeletonBarFull: {
    width: "100%",
  },
  skeletonBarWide: {
    width: "85%",
  },
  skeletonBarMid: {
    width: "70%",
  },
  skeletonBarNarrow: {
    width: "50%",
  },
  errorText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s4,
  },
  retryRow: {
    paddingVertical: spacing.s2,
  },
  retryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: colors.primary,
  },
});
