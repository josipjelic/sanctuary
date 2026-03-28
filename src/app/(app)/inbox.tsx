import { Card, Tag } from "@/components";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import type { Thought } from "@/types/thought";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 50;

type InboxThought = Pick<
  Thought,
  "id" | "body" | "tags" | "transcription_status" | "created_at"
>;

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

async function fetchThoughtsPage(offset: number): Promise<InboxThought[]> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, body, tags, transcription_status, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return (data ?? []) as InboxThought[];
}

function SkeletonRow() {
  return (
    <Card style={styles.card} testID="skeleton-row">
      <View style={[styles.skeletonLine, styles.skeletonLineLong]} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      <View style={[styles.skeletonLine, styles.skeletonLineXShort]} />
    </Card>
  );
}

function ThoughtRow({ item }: { item: InboxThought }) {
  const isPending =
    item.transcription_status === "pending" || item.body.trim() === "";

  return (
    <Card style={styles.card} testID={`thought-row-${item.id}`}>
      <Text
        style={[styles.bodyText, isPending && styles.bodyTextPending]}
        numberOfLines={2}
        accessibilityLabel={isPending ? "Transcribing" : item.body}
      >
        {isPending ? "Transcribing\u2026" : item.body}
      </Text>

      {item.tags.length > 0 && (
        <View style={styles.tagsRow} accessibilityRole="list">
          {item.tags.map((tag) => (
            <Tag key={tag} label={tag} testID={`tag-${tag}`} />
          ))}
        </View>
      )}

      <Text style={styles.timestampText}>
        {formatRelativeTime(item.created_at)}
      </Text>
    </Card>
  );
}

export default function InboxScreen() {
  const [thoughts, setThoughts] = useState<InboxThought[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchThoughtsPage(0);
      setThoughts(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const rows = await fetchThoughtsPage(0);
      setThoughts(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length === PAGE_SIZE);
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
    } finally {
      setLoadingMore(false);
    }
  }

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
      <FlatList
        data={thoughts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThoughtRow item={item} />}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
  card: {
    padding: spacing.s6,
    gap: spacing.s2,
  },
  bodyText: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  bodyTextPending: {
    color: colors.outlineVariant,
    fontStyle: "italic",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
  timestampText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginTop: spacing.s2,
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
