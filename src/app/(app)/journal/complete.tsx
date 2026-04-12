import { Button } from "@/components";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AUTO_REDIRECT_SECONDS = 5;

export default function JournalCompleteScreen() {
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);
  const countdownCancelled = useRef(false);

  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        scaleAnim.setValue(1);
      } else {
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 20,
          mass: 1,
          stiffness: 100,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [scaleAnim]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (countdownCancelled.current) {
        clearInterval(timer);
        return;
      }
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace("/(app)/journal");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function handleBackToJournal() {
    countdownCancelled.current = true;
    router.replace("/(app)/journal");
  }

  function handleViewProfile() {
    countdownCancelled.current = true;
    router.push("/(app)/journal/profile");
  }

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Invisible live region for screen reader announcement */}
        <View
          accessible
          accessibilityLiveRegion="assertive"
          accessibilityLabel="Journal session saved"
          style={styles.srAnnounce}
        />

        <View style={styles.content}>
          <Animated.View
            style={{ transform: [{ scale: scaleAnim }] }}
            accessibilityElementsHidden
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={colors.primary}
            />
          </Animated.View>

          <Text style={styles.headline} accessibilityRole="header">
            Reflection saved.
          </Text>
          <Text style={styles.subtitle}>Well done for taking the time.</Text>

          <View style={styles.buttons}>
            <Button
              label="Back to journal"
              variant="primary"
              onPress={handleBackToJournal}
              style={styles.primaryButton}
              testID="journal-complete-back-btn"
            />
            <Button
              label="View your profile"
              variant="secondary"
              onPress={handleViewProfile}
              style={styles.secondaryButton}
              testID="journal-complete-profile-btn"
            />
          </View>

          <Text style={styles.autoRedirect} accessibilityLiveRegion="polite">
            {countdown > 0
              ? `Returning to journal in ${countdown}s…`
              : "Returning…"}
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
  },
  srAnnounce: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.s8,
    marginBottom: spacing.s4,
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: spacing.s12,
  },
  buttons: {
    width: "100%",
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
    marginTop: spacing.s4,
  },
  autoRedirect: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textAlign: "center",
    marginTop: spacing.s6,
  },
});
