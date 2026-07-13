import { Button, Card } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SessionRow = {
  id: string;
  created_at: string;
  opening_answer: string | null;
  answered_count: number;
};

function formatSessionDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function JournalHistoryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("journal_sessions")
        .select(
          `
          id,
          created_at,
          journal_entries!journal_entries_session_id_fkey(turn_index, answer)
        `,
        )
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("JournalHistory: failed to load sessions", error);
        return;
      }

      const rows: SessionRow[] = (data ?? []).map((row) => {
        const entries = (row.journal_entries ?? []) as {
          turn_index: number;
          answer: string | null;
        }[];

        const openingEntry = entries.find((e) => e.turn_index === 0);
        const answeredCount = entries.filter(
          (e) => e.answer !== null && e.answer !== "",
        ).length;

        return {
          id: row.id as string,
          created_at: row.created_at as string,
          opening_answer: (openingEntry?.answer as string | null) ?? null,
          answered_count: answeredCount,
        };
      });

      setSessions(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  function handleRefresh() {
    setRefreshing(true);
    void loadSessions();
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer} accessibilityRole="alert">
        <Ionicons
          name="book-outline"
          size={48}
          color={colors.outlineVariant}
          accessibilityElementsHidden
        />
        <Text style={styles.emptyTitle} accessibilityRole="header">
          No journal entries yet.
        </Text>
        <Text style={styles.emptySubtitle}>
          Your first session will appear here.
        </Text>
        <Button
          label="Begin your first journal"
          variant="secondary"
          onPress={() => router.push("/(app)/journal")}
          style={styles.emptyButton}
          testID="journal-history-begin-btn"
        />
      </View>
    );
  }

  function renderItem({ item }: { item: SessionRow }) {
    const previewText = item.opening_answer?.slice(0, 100) ?? "";
    const dateStr = formatSessionDate(item.created_at);
    const questionCount = item.answered_count;
    const label = `Journal entry, ${dateStr}, ${questionCount} ${questionCount === 1 ? "question" : "questions"} answered. Preview: ${previewText.slice(0, 60)}`;

    return (
      <Card
        variant="flat"
        size="lg"
        style={styles.sessionCard}
        testID={`journal-history-card-${item.id}`}
      >
        <View accessibilityLabel={label}>
          <Text style={styles.sessionDate}>{dateStr}</Text>
          <Text
            style={styles.sessionPreview}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {previewText || "No answer recorded."}
          </Text>
          <View style={styles.sessionFooter}>
            <View style={styles.questionCountPill}>
              <Text style={styles.questionCountText}>
                {questionCount} {questionCount === 1 ? "question" : "questions"}{" "}
                answered
              </Text>
            </View>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={colors.outlineVariant}
              style={styles.forwardIcon}
              accessibilityElementsHidden
            />
          </View>
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <LinearGradient
        colors={[colors.primaryContainer, colors.surface]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Past entries
            </Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Past entries
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          testID="journal-history-list"
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    backgroundColor: `${colors.primary}14`,
  },
  headerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s6,
    paddingBottom: spacing.s12,
    flexGrow: 1,
  },
  separator: {
    height: spacing.s4,
  },
  sessionCard: {
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s6,
  },
  sessionDate: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    letterSpacing: 0.5,
    marginBottom: spacing.s4,
  },
  sessionPreview: {
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 26,
    marginBottom: spacing.s4,
  },
  sessionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questionCountPill: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.s2,
  },
  questionCountText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
  },
  forwardIcon: {
    opacity: 0.4,
  },
  emptyContainer: {
    marginTop: spacing.s20,
    alignItems: "center",
    paddingHorizontal: spacing.s8,
  },
  emptyTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.s6,
  },
  emptySubtitle: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    marginTop: spacing.s4,
  },
  emptyButton: {
    width: "80%",
    alignSelf: "center",
    marginTop: spacing.s8,
  },
});
