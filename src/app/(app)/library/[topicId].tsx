import { ThoughtListCard } from "@/components";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import type { ThoughtListPreview } from "@/types/thoughtList";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAGE_SIZE = 50;

async function fetchThoughtsForTopicPage(
  topicName: string,
  offset: number,
): Promise<ThoughtListPreview[]> {
  const { data, error } = await supabase
    .from("thoughts")
    .select(
      "id, body, topics, transcription_status, tagging_status, created_at",
    )
    .contains("topics", [topicName])
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;
  return (data ?? []) as ThoughtListPreview[];
}

export default function LibraryTopicDetailScreen() {
  const rawTopicId = useLocalSearchParams<{
    topicId?: string | string[];
  }>().topicId;
  const topicId = typeof rawTopicId === "string" ? rawTopicId : rawTopicId?.[0];
  const navigation = useNavigation();
  const router = useRouter();
  const [topicStatus, setTopicStatus] = useState<
    "pending" | "found" | "missing"
  >("pending");
  const [topicName, setTopicName] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtListPreview[]>([]);
  const [loadingThoughts, setLoadingThoughts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: topicName ?? "Topic",
    });
  }, [navigation, topicName]);

  const loadTopic = useCallback(async () => {
    if (!topicId) {
      setTopicStatus("missing");
      setTopicName(null);
      return;
    }

    setTopicStatus("pending");
    const { data, error } = await supabase
      .from("user_topics")
      .select("id, name")
      .eq("id", topicId)
      .maybeSingle();

    if (error || !data) {
      setTopicStatus("missing");
      setTopicName(null);
      return;
    }

    setTopicName(data.name);
    setTopicStatus("found");
  }, [topicId]);

  const loadThoughtsInitial = useCallback(async () => {
    if (!topicName) return;
    setLoadingThoughts(true);
    try {
      const rows = await fetchThoughtsForTopicPage(topicName, 0);
      setThoughts(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setThoughts([]);
      setHasMore(false);
    } finally {
      setLoadingThoughts(false);
    }
  }, [topicName]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  useEffect(() => {
    if (topicName) {
      loadThoughtsInitial();
    }
  }, [topicName, loadThoughtsInitial]);

  useFocusEffect(
    useCallback(() => {
      if (topicName) {
        loadThoughtsInitial();
      }
    }, [topicName, loadThoughtsInitial]),
  );

  async function handleLoadMore() {
    if (!topicName || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchThoughtsForTopicPage(
        topicName,
        offsetRef.current,
      );
      setThoughts((prev) => [...prev, ...rows]);
      offsetRef.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!topicId || topicStatus === "missing") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Topic not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (topicStatus === "pending" || (loadingThoughts && thoughts.length === 0)) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View
            style={styles.emptyState}
            accessibilityRole="text"
            accessibilityLabel="No thoughts in this topic yet."
          >
            <Text style={styles.emptyText}>No thoughts in this topic yet.</Text>
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
        testID="library-topic-thoughts-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s16,
  },
  emptyText: {
    ...typography.bodyLg,
    color: colors.outlineVariant,
    textAlign: "center",
  },
  errorText: {
    ...typography.bodyLg,
    color: colors.error,
    textAlign: "center",
  },
  footer: {
    paddingVertical: spacing.s6,
  },
});
