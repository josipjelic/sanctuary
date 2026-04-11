import { Button } from "@/components";
import { colors, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OnboardingWelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [fadeAnim]);

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {router.canDismiss() && (
          <View style={styles.closeRow}>
            <Pressable
              onPress={() => router.dismiss()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="onboarding-close"
            >
              <Ionicons name="close" size={22} color={colors.primary} />
            </Pressable>
          </View>
        )}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.brandMark} accessibilityLabel="Sanctuary">
              sanctuary
            </Text>

            <Text style={styles.headline} accessibilityRole="header">
              Let's get to know you.
            </Text>

            <Text style={styles.subheadline}>
              Your answers shape a personal sanctuary — and the gentle nudges
              that help you flourish.
            </Text>

            <Text style={styles.body}>
              You'll answer a few open-ended questions. There are no right
              answers — only yours. It takes about three minutes.
            </Text>

            <Button
              label="Begin"
              variant="primary"
              onPress={() => router.push("/(onboarding)/questions")}
              style={styles.cta}
              testID="onboarding-begin"
            />

            <Text style={styles.privacyNote} accessibilityRole="text">
              Your reflections are private and never shared.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  closeRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    backgroundColor: `${colors.primary}18`,
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
  brandMark: {
    ...typography.labelMd,
    color: colors.primary,
    letterSpacing: 4,
    marginTop: spacing.s20,
    marginBottom: spacing.s12,
  },
  headline: {
    ...typography.displayLg,
    color: colors.onSurface,
    marginBottom: spacing.s4,
  },
  subheadline: {
    ...typography.headlineMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s6,
  },
  body: {
    ...typography.bodyLg,
    color: colors.secondary,
    lineHeight: 26,
    marginBottom: spacing.s16,
  },
  cta: {
    width: "100%",
  },
  privacyNote: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textAlign: "center",
    marginTop: spacing.s4,
  },
});
