import { Card, ThoughtListCard } from "@/components";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import type { ThoughtListPreview } from "@/types/thoughtList";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 50;

type InboxThought = ThoughtListPreview;

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
        renderItem={({ item }) => (
          <ThoughtListCard
            item={item}
            onPress={() => router.push(`/inbox/${item.id}`)}
          />
        )}
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
