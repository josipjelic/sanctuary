import { Button, TextInput, TopicFolderCard } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { normalizeTopicLabel } from "@/lib/normalizeTopicLabel";
import { supabase } from "@/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type UserTopicRow = {
  id: string;
  name: string;
  normalized_name: string;
};

type UserTopicWithCount = UserTopicRow & { thoughtCount: number };

function buildTopicCounts(
  rows: { topics: string[] }[] | null,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    for (const n of row.topics) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  return counts;
}

export default function LibraryIndexScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();

  const [topics, setTopics] = useState<UserTopicWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [newTopicRaw, setNewTopicRaw] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: topicRows, error: topicErr } = await supabase
      .from("user_topics")
      .select("id, name, normalized_name")
      .order("name", { ascending: true });

    if (topicErr) throw topicErr;

    const { data: thoughtRows, error: thoughtErr } = await supabase
      .from("thoughts")
      .select("topics");

    if (thoughtErr) throw thoughtErr;

    const counts = buildTopicCounts(thoughtRows);
    const list = (topicRows ?? []) as UserTopicRow[];
    setTopics(
      list.map((t) => ({
        ...t,
        thoughtCount: counts.get(t.name) ?? 0,
      })),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch {
        if (!cancelled) setTopics([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch {
      /* keep list */
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddTopic() {
    setAddError(null);
    const normalized = normalizeTopicLabel(newTopicRaw);
    if (!normalized) {
      setAddError("Enter a topic name.");
      return;
    }
    const uid = session?.user?.id;
    if (!uid) {
      setAddError("You must be signed in.");
      return;
    }

    setAddSubmitting(true);
    try {
      const { error } = await supabase.from("user_topics").insert({
        user_id: uid,
        name: normalized,
        normalized_name: normalized,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === "23505") {
          setAddError("You already have this topic.");
        } else {
          setAddError("Could not add topic. Try again.");
        }
        return;
      }

      setNewTopicRaw("");
      setManageVisible(false);
      await load();
    } finally {
      setAddSubmitting(false);
    }
  }

  const titleFontSize = width < 380 ? 40 : 52;

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.headerTextBlock}>
        <Text
          style={[
            styles.title,
            { fontSize: titleFontSize, lineHeight: titleFontSize + 4 },
          ]}
          accessibilityRole="header"
        >
          Library
        </Text>
        <Text style={styles.subtitle}>
          Your thoughts, curated and organized by the sanctuary&apos;s
          intelligence.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          setAddError(null);
          setManageVisible(true);
        }}
        style={({ pressed }) => [
          styles.manageBtn,
          pressed && styles.manageBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Manage lists"
        testID="library-manage-lists"
      >
        <MaterialCommunityIcons
          name="tune-vertical"
          size={22}
          color={colors.onPrimary}
        />
        <Text style={styles.manageBtnLabel}>Manage lists</Text>
      </Pressable>
    </View>
  );

  const listFooter = (
    <View style={styles.reflection} testID="library-reflection">
      <MaterialCommunityIcons
        name="spa-outline"
        size={56}
        color={colors.primaryContainer}
      />
      <Text style={styles.reflectionTitle}>Mindful organization</Text>
      <Text style={styles.reflectionBody}>
        Organizing your thoughts shouldn&apos;t feel like a chore. The Sanctuary
        automatically groups similar concepts, leaving you free to simply
        express yourself.
      </Text>
      <View style={styles.reflectionRule} />
      <Text style={styles.reflectionTagline}>
        Everything in its right place
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        numColumns={1}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        renderItem={({ item }) => (
          <TopicFolderCard
            id={item.id}
            name={item.name}
            normalizedName={item.normalized_name}
            thoughtCount={item.thoughtCount}
            onPress={() =>
              router.push({
                pathname: "/(app)/library/[topicId]",
                params: { topicId: item.id },
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyTopics} testID="library-empty-topics">
            No topics yet. Tap Manage lists to add your first topic.
          </Text>
        }
        testID="library-topic-grid"
      />

      <Modal
        visible={manageVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setManageVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setManageVisible(false)}
          accessibilityLabel="Close dialog"
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Manage lists</Text>
            <Text style={styles.modalHint}>
              Add a new topic to your library.
            </Text>
            <TextInput
              placeholder="Topic name"
              value={newTopicRaw}
              onChangeText={(t) => {
                setNewTopicRaw(t);
                setAddError(null);
              }}
              autoCapitalize="sentences"
              autoCorrect
              editable={!addSubmitting}
              testID="library-add-topic-input"
            />
            {addError ? (
              <Text style={styles.modalError} testID="library-add-topic-error">
                {addError}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setManageVisible(false)}
                disabled={addSubmitting}
                testID="library-add-topic-cancel"
              />
              <Button
                label="Add topic"
                onPress={handleAddTopic}
                disabled={addSubmitting}
                testID="library-add-topic-submit"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: spacing.s6,
    paddingBottom: spacing.s24,
    flexGrow: 1,
  },
  headerBlock: {
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s6,
    marginBottom: spacing.s12,
    gap: spacing.s6,
  },
  headerTextBlock: {
    gap: spacing.s4,
  },
  title: {
    fontFamily: "Manrope_700Bold",
    color: colors.onSurface,
    letterSpacing: -2,
  },
  subtitle: {
    ...typography.bodyLg,
    color: colors.secondary,
    maxWidth: 360,
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.s2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    borderRadius: radius.full,
  },
  manageBtnPressed: {
    opacity: 0.9,
  },
  manageBtnLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onPrimary,
  },
  emptyTopics: {
    ...typography.bodyLg,
    color: colors.outlineVariant,
    textAlign: "center",
    paddingHorizontal: spacing.s8,
    paddingVertical: spacing.s12,
  },
  reflection: {
    marginHorizontal: spacing.s8,
    marginTop: spacing.s20,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.s16,
    alignItems: "center",
    ...shadows.card,
  },
  reflectionTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginTop: spacing.s6,
    marginBottom: spacing.s4,
    textAlign: "center",
  },
  reflectionBody: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    maxWidth: 400,
    marginBottom: spacing.s8,
  },
  reflectionRule: {
    width: 96,
    height: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.35,
    marginBottom: spacing.s8,
  },
  reflectionTagline: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    color: colors.primary,
    textTransform: "uppercase",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: `${colors.onSurface}66`,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
    gap: spacing.s4,
  },
  modalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  modalHint: {
    ...typography.bodyLg,
    color: colors.secondary,
    marginBottom: spacing.s2,
  },
  modalError: {
    ...typography.labelMd,
    color: colors.error,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.s4,
    marginTop: spacing.s6,
  },
});
