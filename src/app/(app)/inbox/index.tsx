import {
  Card,
  ReminderApprovalSheet,
  ReminderEditSheet,
  ThoughtListCard,
} from "@/components";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Reminder } from "@/types/reminder";
import type { ThoughtListPreview } from "@/types/thoughtList";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 50;

type InboxThought = ThoughtListPreview;

/** Reminder status summary for a single thought's reminders. */
type ThoughtReminderStatus = "pending" | "approved" | null;

async function fetchThoughtsPage(offset: number): Promise<InboxThought[]> {
  const { data, error } = await supabase
    .from("thoughts")
    .select(
      "id, body, topics, transcription_status, tagging_status, created_at",
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return (data ?? []) as InboxThought[];
}

async function fetchPendingReminderCount(): Promise<number> {
  const { count, error } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("status", "inactive");
  if (error) return 0;
  return count ?? 0;
}

/**
 * For the given thought IDs, returns a map of thought_id -> reminder status.
 * Only returns entries that have at least one non-dismissed reminder.
 */
async function fetchActiveReminderForThought(
  thoughtId: string,
): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from("reminders")
    .select(
      "id, user_id, thought_id, extracted_text, scheduled_at, status, notification_id, lead_time, created_at, updated_at",
    )
    .eq("thought_id", thoughtId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Reminder | null) ?? null;
}

async function fetchReminderStatusMap(
  thoughtIds: string[],
): Promise<Record<string, ThoughtReminderStatus>> {
  if (thoughtIds.length === 0) return {};

  const { data, error } = await supabase
    .from("reminders")
    .select("thought_id, status")
    .in("thought_id", thoughtIds)
    .in("status", ["inactive", "active"]);

  if (error) return {};

  const result: Record<string, ThoughtReminderStatus> = {};
  for (const row of data ?? []) {
    const id = row.thought_id as string;
    const status = row.status as string;
    // "inactive" = pending approval takes priority over approved
    if (status === "inactive") {
      result[id] = "pending";
    } else if (status === "active" && result[id] !== "pending") {
      result[id] = "approved";
    }
  }
  return result;
}

function SkeletonRow() {
  return (
    <Card style={styles.skeletonCard} testID="skeleton-row">
      <View style={[styles.skeletonLine, styles.skeletonLineLong]} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      <View style={[styles.skeletonLine, styles.skeletonLineXShort]} />
    </Card>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<InboxThought[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const [pendingReminderCount, setPendingReminderCount] = useState(0);
  const [reminderStatusMap, setReminderStatusMap] = useState<
    Record<string, ThoughtReminderStatus>
  >({});
  const [approvalSheetVisible, setApprovalSheetVisible] = useState(false);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);
  const [reminderSheetRow, setReminderSheetRow] = useState<Reminder | null>(
    null,
  );

  const loadReminders = useCallback(async (ids: string[]) => {
    const [count, statusMap] = await Promise.all([
      fetchPendingReminderCount(),
      fetchReminderStatusMap(ids),
    ]);
    setPendingReminderCount(count);
    setReminderStatusMap(statusMap);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchThoughtsPage(0);
      setThoughts(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      void loadReminders(rows.map((r) => r.id));
    } finally {
      setLoading(false);
    }
  }, [loadReminders]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const rows = await fetchThoughtsPage(0);
      setThoughts(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      void loadReminders(rows.map((r) => r.id));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchThoughtsPage(offsetRef.current);
      setThoughts((prev) => [...prev, ...rows]);
      offsetRef.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      void loadReminders(rows.map((r) => r.id));
    } finally {
      setLoadingMore(false);
    }
  }

  function handleApprovalChange() {
    // Re-query counts and status map after the user acts on a reminder
    void loadReminders(thoughts.map((t) => t.id));
  }

  const pillLabel =
    pendingReminderCount === 1
      ? "1 reminder to review"
      : `${pendingReminderCount} reminders to review`;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.listContent}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Pending-reminders pill — above the list, outside FlatList */}
      {pendingReminderCount > 0 && (
        <View style={styles.pillWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.pill,
              pressed && styles.pillPressed,
            ]}
            onPress={() => setApprovalSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Review pending reminders, ${pendingReminderCount} waiting`}
            accessibilityHint="Opens the reminders review sheet"
          >
            <Ionicons
              name="notifications"
              size={14}
              color={colors.onPrimaryContainer}
            />
            <Text style={styles.pillText}>{pillLabel}</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.onPrimaryContainer}
            />
          </Pressable>
        </View>
      )}

      <FlatList
        data={thoughts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const reminderStatus = reminderStatusMap[item.id] ?? null;
          return (
            <ThoughtListCard
              item={item}
              onPress={() => router.push(`/inbox/${item.id}`)}
              hasPendingReminder={reminderStatus === "pending"}
              hasApprovedReminder={reminderStatus === "approved"}
              onBellPress={
                reminderStatus === "pending"
                  ? () => setApprovalSheetVisible(true)
                  : reminderStatus === "approved"
                    ? () => {
                        void (async () => {
                          const r = await fetchActiveReminderForThought(
                            item.id,
                          );
                          if (r) {
                            setReminderSheetRow(r);
                            setReminderSheetVisible(true);
                          }
                        })();
                      }
                    : undefined
              }
            />
          );
        }}
        contentContainerStyle={
          thoughts.length === 0 ? styles.emptyContainer : styles.listContent
        }
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View
            style={styles.emptyState}
            accessibilityRole="text"
            accessibilityLabel="Your sanctuary awaits. Capture your first thought."
          >
            <Text style={styles.emptyText}>
              {"Your sanctuary awaits.\nCapture your first thought."}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={styles.footer}
              color={colors.outline}
              accessibilityLabel="Loading more thoughts"
            />
          ) : null
        }
        testID="thoughts-list"
      />

      <ReminderApprovalSheet
        visible={approvalSheetVisible}
        onClose={() => setApprovalSheetVisible(false)}
        onApprovalChange={handleApprovalChange}
      />
      <ReminderEditSheet
        visible={reminderSheetVisible}
        reminder={reminderSheetRow}
        onClose={() => {
          setReminderSheetVisible(false);
          setReminderSheetRow(null);
        }}
        onReminderChanged={handleApprovalChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  pillWrapper: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    paddingBottom: 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.full,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s4,
    minHeight: 44,
    justifyContent: "center",
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: colors.onPrimaryContainer,
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s6,
    paddingBottom: spacing.s8,
    gap: spacing.s4,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.s4,
  },
  skeletonCard: {
    padding: spacing.s6,
    gap: spacing.s2,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s8,
  },
  emptyText: {
    ...typography.bodyLg,
    color: colors.outlineVariant,
    textAlign: "center",
  },
  footer: {
    paddingVertical: spacing.s6,
  },
  skeletonLine: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 4,
    opacity: 0.3,
    height: 14,
  },
  skeletonLineLong: {
    width: "90%",
  },
  skeletonLineShort: {
    width: "65%",
    marginTop: spacing.s2,
  },
  skeletonLineXShort: {
    width: "30%",
    marginTop: spacing.s2,
  },
});
