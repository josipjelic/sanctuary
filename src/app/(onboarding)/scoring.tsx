import { Button } from "@/components";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import type { OceanAnswer } from "@/types/oceanProfile";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MIN_DISPLAY_MS = 1500;

export default function OnboardingScoringScreen() {
  const params = useLocalSearchParams<{ answers: string }>();
  const [hasError, setHasError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const breatheAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const answers: OceanAnswer[] = (() => {
    try {
      return JSON.parse(params.answers ?? "[]") as OceanAnswer[];
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      setReducedMotion(reduced);
      if (!reduced) {
        startBreathing();
      }
    });

    void scoreProfile();

    return () => {
      breatheAnimation.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startBreathing() {
    breatheAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    breatheAnimation.current.start();
  }

  function stopBreathing() {
    breatheAnimation.current?.stop();
    scaleAnim.setValue(1.0);
  }

  async function scoreProfile() {
    setHasError(false);
    const startTime = Date.now();

    // Filter out unanswered questions before sending — the edge function
    // rejects items with empty answer strings.
    const answeredItems = answers.filter((a) => a.answer.trim().length > 0);

    if (answeredItems.length === 0) {
      // Nothing to score — navigate straight to the completion screen.
      router.replace("/(onboarding)/complete");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "score-ocean-profile",
        {
          body: {
            answers: answeredItems,
            question_set_version: "v1",
          },
        },
      );

      if (error) throw error;

      const elapsed = Date.now() - startTime;
      const remaining = MIN_DISPLAY_MS - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      logger.debug("score-ocean-profile success", {
        profile: data?.profile,
      });

      stopBreathing();
      router.replace("/(onboarding)/complete");
    } catch (err) {
      logger.error("score-ocean-profile failed", err);
      stopBreathing();
      setHasError(true);
    }
  }

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.container} accessibilityLiveRegion="polite">
          {/* Breathing circle */}
          <Animated.View
            style={[
              styles.circle,
              !reducedMotion && {
                transform: [{ scale: scaleAnim }],
              },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />

          <Text style={styles.headline} accessibilityRole="header">
            {hasError ? "Something didn't quite work." : "Getting to know you…"}
          </Text>

          <View accessibilityRole={hasError ? "alert" : "none"}>
            <Text style={styles.body}>
              {hasError
                ? "It happens. Tap below to try again — your answers are safe."
                : "We're reading between the lines of your answers to understand what makes you, you."}
            </Text>
          </View>

          {!hasError && (
            <Text style={styles.microcopy}>This only takes a moment.</Text>
          )}

          {hasError && (
            <Button
              label="Try again"
              variant="primary"
              onPress={() => void scoreProfile()}
              style={styles.retryButton}
              testID="scoring-retry"
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: colors.primaryContainer,
    marginBottom: spacing.s8,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: spacing.s4,
  },
  body: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: spacing.s16,
  },
  microcopy: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.s8,
  },
});
