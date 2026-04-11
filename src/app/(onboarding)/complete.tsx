import { Button } from "@/components";
import { useOnboardingContext } from "@/contexts/OnboardingContext";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import {
  cancelReminder,
  requestNotificationPermission,
  scheduleDailyMorningNotification,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEFAULT_MORNING_TIME = "07:30";

export default function OnboardingCompleteScreen() {
  const { session } = useAuth();
  const { markComplete } = useOnboardingContext();
  const cardScale = useRef(new Animated.Value(0.8)).current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: cardScale is a stable ref from useRef
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        cardScale.setValue(1.0);
        return;
      }
      Animated.spring(cardScale, {
        toValue: 1.0,
        ...{ damping: 20, mass: 1, stiffness: 100 },
        useNativeDriver: true,
      }).start();
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        await markComplete(session.user.id);
      } catch (err) {
        logger.debug("markOnboardingComplete failed (non-fatal)", {
          error: String(err),
        });
      }
      void scheduleNotification();
    })();
  }, [session, markComplete]);

  async function scheduleNotification() {
    if (!session) return;
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const { data } = await supabase
        .from("user_preferences")
        .select("key, value")
        .in("key", ["morning_notification_time", "morning_notification_id"])
        .eq("user_id", session.user.id);

      let morningTime = DEFAULT_MORNING_TIME;
      let existingNotificationId: string | null = null;

      for (const row of data ?? []) {
        if (row.key === "morning_notification_time") {
          morningTime = row.value as string;
        } else if (row.key === "morning_notification_id") {
          existingNotificationId = row.value as string;
        }
      }

      if (existingNotificationId) {
        await cancelReminder(existingNotificationId);
      }

      const [hourStr, minuteStr] = morningTime.split(":");
      const hour = Number.parseInt(hourStr, 10);
      const minute = Number.parseInt(minuteStr, 10);

      const notificationId = await scheduleDailyMorningNotification({
        title: "Good morning",
        body: "Your morning reflection is ready — open Sanctuary",
        hour,
        minute,
      });

      await supabase.from("user_preferences").upsert(
        {
          user_id: session.user.id,
          key: "morning_notification_id",
          value: notificationId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, key" },
      );
    } catch (err) {
      logger.debug("scheduleNotification failed (non-fatal)", {
        error: String(err),
      });
    }
  }

  function handleBegin() {
    // If navigated here from within the app (profile icon), go back.
    // Otherwise (initial launch path), replace into the app tabs.
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace("/(app)");
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.celebrationCard,
              { transform: [{ scale: cardScale }] },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name="leaf-outline" size={36} color={colors.primary} />
          </Animated.View>

          <Text style={styles.headline} accessibilityRole="header">
            Your sanctuary is ready.
          </Text>

          <Text style={styles.body}>
            From here, your morning messages, your thoughts, and your
            reflections will all carry a little more of you.
          </Text>

          <Button
            label="Begin your first capture"
            variant="primary"
            onPress={handleBegin}
            style={styles.cta}
            testID="onboarding-complete-begin"
          />

          <Text style={styles.settingsNote}>
            You can update your preferences at any time in Settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s12,
    justifyContent: "center",
  },
  celebrationCard: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryContainer,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.s20,
    marginBottom: spacing.s8,
  },
  headline: {
    ...typography.displayLg,
    color: colors.onSurface,
    lineHeight: 64,
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
  settingsNote: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textAlign: "center",
    marginTop: spacing.s4,
  },
});
