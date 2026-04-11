import { Button, Card } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const JOURNAL_OPENING_QUESTION_V1 =
  "Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?";

type PendingSession = {
  id: string;
  created_at: string;
  opening_answer: string | null;
};

function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 2) return "Started just now";
  if (diffMin < 60) return `Started ${diffMin} minutes ago`;
  if (diffHours === 1) return "Started 1 hour ago";
  if (diffHours < 6) return `Started ${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 0) return "Started earlier today";
  if (diffDays === 1) return "Started yesterday";
  return `Started ${diffDays} days ago`;
}

export default function JournalHomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const [pendingSession, setPendingSession] = useState<PendingSession | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const loadPendingSession = useCallback(async () => {
    setActionError(null);
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: sessionRow, error: sessionError } = await supabase
        .from("journal_sessions")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        logger.error(
          "JournalHome: failed to load pending session",
          sessionError,
        );
        setPendingSession(null);
        return;
      }

      if (!sessionRow) {
        setPendingSession(null);
        return;
      }

      const { data: entryRow } = await supabase
        .from("journal_entries")
        .select("answer")
        .eq("session_id", sessionRow.id)
        .eq("turn_index", 0)
        .maybeSingle();

      setPendingSession({
        id: sessionRow.id as string,
        created_at: sessionRow.created_at as string,
        opening_answer: (entryRow?.answer as string | null) ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadPendingSession();
    }, [loadPendingSession]),
  );

  async function createNewSession(): Promise<string | null> {
    const { data: newSession, error: insertError } = await supabase
      .from("journal_sessions")
      .insert({
        user_id: userId,
        status: "pending",
        opening_question_version: "v1",
      })
      .select("id")
      .single();

    if (insertError || !newSession) {
      logger.error("JournalHome: failed to insert session", insertError);
      setActionError("Couldn't start your journal. Try again.");
      return null;
    }

    await supabase.from("journal_entries").insert({
      session_id: newSession.id,
      user_id: userId,
      turn_index: 0,
      question: JOURNAL_OPENING_QUESTION_V1,
      answer: null,
    });

    return newSession.id as string;
  }

  async function handleBegin() {
    setIsStarting(true);
    setActionError(null);
    try {
      const sessionId = await createNewSession();
      if (sessionId) {
        router.push({
          pathname: "/(app)/journal/session",
          params: { sessionId },
        });
      }
    } finally {
      setIsStarting(false);
    }
  }

  async function handleContinue() {
    if (!pendingSession) return;
    router.push({
      pathname: "/(app)/journal/session",
      params: { sessionId: pendingSession.id },
    });
  }

  async function handleStartFresh() {
    if (!pendingSession) return;
    setIsStarting(true);
    setActionError(null);
    try {
      await supabase
        .from("journal_sessions")
        .update({ status: "abandoned" })
        .eq("id", pendingSession.id);

      const sessionId = await createNewSession();
      if (sessionId) {
        router.push({
          pathname: "/(app)/journal/session",
          params: { sessionId },
        });
      }
    } finally {
      setIsStarting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandMark}>sanctuary</Text>
        </View>

        {/* State A — no pending session */}
        {!pendingSession && (
          <View style={styles.heroBlock}>
            <Text style={styles.heroTitle} accessibilityRole="header">
              Your daily reflection
            </Text>
            <Text style={styles.heroSubtitle}>
              A quiet space to make sense of your day.
            </Text>
            <View style={styles.ctaWrapper}>
              <Button
                label={isStarting ? "Starting…" : "Begin today's journal"}
                variant="primary"
                onPress={() => void handleBegin()}
                disabled={isStarting}
                style={styles.ctaButton}
                testID="journal-begin-btn"
              />
            </View>
            {actionError && (
              <View style={styles.errorRow}>
                <Text style={styles.errorText}>{actionError}</Text>
                <Pressable
                  onPress={() => void handleBegin()}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Text style={styles.retryText}> Try again</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* State B — incomplete session */}
        {pendingSession && (
          <View style={styles.resumeBlock}>
            <Card
              variant="elevated"
              size="xl"
              style={styles.resumeCard}
              testID="journal-resume-card"
            >
              <View
                accessibilityLabel={`Incomplete journal session, ${formatRelativeTime(pendingSession.created_at)}`}
              >
                <Text style={styles.resumeTimestamp}>
                  {formatRelativeTime(pendingSession.created_at)}
                </Text>
                {pendingSession.opening_answer ? (
                  <Text style={styles.resumePreview} numberOfLines={2}>
                    {pendingSession.opening_answer.slice(0, 100)}
                  </Text>
                ) : (
                  <View>
                    <Text style={styles.resumeNotStartedLabel}>
                      You were just getting started.
                    </Text>
                    <Text
                      style={styles.resumeQuestionPreview}
                      numberOfLines={2}
                    >
                      {JOURNAL_OPENING_QUESTION_V1}
                    </Text>
                  </View>
                )}
                <View style={styles.resumeButtons}>
                  <Button
                    label="Continue"
                    variant="primary"
                    onPress={() => void handleContinue()}
                    disabled={isStarting}
                    style={styles.resumeButtonFlex}
                    testID="journal-continue-btn"
                  />
                  <Button
                    label="Start fresh"
                    variant="secondary"
                    onPress={() => void handleStartFresh()}
                    disabled={isStarting}
                    style={styles.resumeButtonFlex}
                    testID="journal-start-fresh-btn"
                  />
                </View>
                {actionError && (
                  <Text style={[styles.errorText, styles.resumeError]}>
                    {actionError}
                  </Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Past entries row */}
        <Pressable
          style={({ pressed }) => [
            styles.pastEntriesRow,
            pressed && styles.pastEntriesRowPressed,
          ]}
          onPress={() => router.push("/(app)/journal/history")}
          accessibilityRole="button"
          accessibilityLabel="Past journal entries"
          accessibilityHint="Shows your completed journal sessions"
          testID="journal-past-entries-btn"
        >
          <Text style={styles.pastEntriesLabel}>Past entries</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.s12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s4,
  },
  brandMark: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 4,
    color: colors.primary,
  },
  heroBlock: {
    paddingHorizontal: spacing.s8,
    marginTop: spacing.s20,
    flex: 1,
  },
  heroTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  heroSubtitle: {
    ...typography.bodyLg,
    color: colors.secondary,
    marginTop: spacing.s4,
    lineHeight: 26,
  },
  ctaWrapper: {
    marginTop: spacing.s16,
  },
  ctaButton: {
    width: "100%",
  },
  errorRow: {
    flexDirection: "row",
    marginTop: spacing.s2,
    alignItems: "center",
  },
  errorText: {
    ...typography.labelMd,
    color: colors.error,
  },
  retryText: {
    ...typography.labelMd,
    color: colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  resumeBlock: {
    marginTop: spacing.s2,
    marginHorizontal: spacing.s8,
  },
  resumeCard: {
    padding: spacing.s8,
  },
  resumeTimestamp: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginBottom: spacing.s4,
  },
  resumePreview: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
    marginBottom: spacing.s6,
    lineHeight: 26,
  },
  resumeNotStartedLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginBottom: 4,
  },
  resumeQuestionPreview: {
    ...typography.bodyLg,
    color: colors.outlineVariant,
    marginBottom: spacing.s6,
    lineHeight: 26,
  },
  resumeButtons: {
    flexDirection: "row",
    gap: spacing.s4,
    marginTop: spacing.s2,
  },
  resumeButtonFlex: {
    flex: 1,
  },
  resumeError: {
    marginTop: spacing.s4,
    textAlign: "center",
  },
  pastEntriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    marginTop: spacing.s8,
    minHeight: 44,
    borderRadius: radius.md,
    marginHorizontal: spacing.s8,
  },
  pastEntriesRowPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  pastEntriesLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
});
