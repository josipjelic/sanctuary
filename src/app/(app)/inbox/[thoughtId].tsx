import { ReminderEditSheet, Topic } from "@/components";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Reminder } from "@/types/reminder";
import type { Thought } from "@/types/thought";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ThoughtDetail = Pick<
  Thought,
  | "id"
  | "body"
  | "body_extended"
  | "topics"
  | "transcription_status"
  | "created_at"
  | "updated_at"
>;

async function fetchThought(thoughtId: string): Promise<ThoughtDetail | null> {
  const { data, error } = await supabase
    .from("thoughts")
    .select(
      "id, body, body_extended, topics, transcription_status, created_at, updated_at",
    )
    .eq("id", thoughtId)
    .single();

  if (error) return null;
  return data as ThoughtDetail;
}

async function fetchReminder(thoughtId: string): Promise<Reminder | null> {
  const { data } = await supabase
    .from("reminders")
    .select(
      "id, user_id, thought_id, extracted_text, scheduled_at, status, notification_id, lead_time, created_at, updated_at",
    )
    .eq("thought_id", thoughtId)
    .in("status", ["inactive", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Reminder | null) ?? null;
}

export default function ThoughtDetailScreen() {
  const rawThoughtId = useLocalSearchParams<{
    thoughtId?: string | string[];
  }>().thoughtId;
  const thoughtId =
    typeof rawThoughtId === "string" ? rawThoughtId : rawThoughtId?.[0];

  const router = useRouter();
  const navigation = useNavigation();

  const [thought, setThought] = useState<ThoughtDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);

  const loadThought = useCallback(async () => {
    if (!thoughtId) return;
    setLoading(true);
    try {
      const [thoughtData, reminderData] = await Promise.all([
        fetchThought(thoughtId),
        fetchReminder(thoughtId),
      ]);
      setThought(thoughtData);
      if (thoughtData) setDraftBody(thoughtData.body);
      setReminder(reminderData);
      if (!reminderData) setReminderSheetVisible(false);
    } finally {
      setLoading(false);
    }
  }, [thoughtId]);

  useEffect(() => {
    loadThought();
  }, [loadThought]);

  const handleEditPress = useCallback(() => {
    setThought((prev) => {
      if (prev) setDraftBody(prev.body);
      return prev;
    });
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setThought((prev) => {
      if (prev) setDraftBody(prev.body);
      return prev;
    });
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!thoughtId) return;
    setIsSaving(true);
    try {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("thoughts")
        .update({ body: draftBody, updated_at: updatedAt })
        .eq("id", thoughtId);

      if (error) {
        Alert.alert("Error", "Could not save changes. Please try again.");
        return;
      }

      setThought((prev) =>
        prev ? { ...prev, body: draftBody, updated_at: updatedAt } : prev,
      );
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [thoughtId, draftBody]);

  const handleDelete = useCallback(async () => {
    if (!thoughtId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("thoughts")
        .delete()
        .eq("id", thoughtId);

      if (error) {
        Alert.alert("Error", "Could not delete thought. Please try again.");
        setIsDeleting(false);
        return;
      }

      router.back();
    } catch {
      Alert.alert("Error", "Could not delete thought. Please try again.");
      setIsDeleting(false);
    }
  }, [thoughtId, router]);

  const handleDeletePress = useCallback(() => {
    Alert.alert("Delete thought?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: handleDelete,
      },
    ]);
  }, [handleDelete]);

  useLayoutEffect(() => {
    if (isEditing) {
      navigation.setOptions({
        title: "Edit Thought",
        headerRight: () => (
          <View style={styles.headerButtons}>
            <Pressable
              onPress={handleCancelEdit}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
              accessibilityLabel="Cancel editing"
            >
              <Text style={styles.headerButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
              accessibilityLabel="Save changes"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[styles.headerButtonText, styles.headerButtonSave]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        title: "",
        headerRight: () => (
          <View style={styles.headerButtons}>
            <Pressable
              onPress={handleEditPress}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
              accessibilityLabel="Edit thought"
            >
              <Text style={styles.headerButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={handleDeletePress}
              disabled={isDeleting}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
              accessibilityLabel="Delete thought"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text
                  style={[styles.headerButtonText, styles.headerButtonDelete]}
                >
                  Delete
                </Text>
              )}
            </Pressable>
          </View>
        ),
      });
    }
  }, [
    navigation,
    isEditing,
    isSaving,
    isDeleting,
    handleCancelEdit,
    handleSave,
    handleEditPress,
    handleDeletePress,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!thought) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Thought not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isEditing ? (
          <TextInput
            style={styles.bodyInput}
            value={draftBody}
            onChangeText={setDraftBody}
            multiline
            textAlignVertical="top"
            autoFocus
            accessibilityLabel="Edit thought body"
          />
        ) : (
          <Text style={styles.bodyText}>{thought.body}</Text>
        )}

        {thought.topics.length > 0 && (
          <View style={styles.topicsRow} accessibilityRole="list">
            {thought.topics.map((topic) => (
              <Topic key={topic} label={topic} testID={`topic-${topic}`} />
            ))}
          </View>
        )}

        <Text style={styles.timestampText}>
          {formatRelativeTime(thought.created_at)}
        </Text>

        {reminder !== null && (
          <Pressable
            style={({ pressed }) => [
              styles.reminderPromptRow,
              pressed && styles.reminderPromptRowPressed,
            ]}
            onPress={() => setReminderSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={
              reminder.status === "inactive"
                ? "Reminder awaiting your review. Opens reminder sheet."
                : "Scheduled reminder. Opens sheet to reschedule or dismiss."
            }
            accessibilityHint="Opens reminder sheet"
          >
            <Ionicons
              name={
                reminder.status === "inactive"
                  ? "notifications-outline"
                  : "notifications"
              }
              size={18}
              color={
                reminder.status === "inactive"
                  ? colors.primary
                  : colors.outlineVariant
              }
            />
            <Text style={styles.reminderPromptText}>
              {reminder.status === "inactive"
                ? "Reminder · review in sheet"
                : "Reminder · tap to reschedule"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.outlineVariant}
            />
          </Pressable>
        )}
      </ScrollView>

      <ReminderEditSheet
        visible={reminderSheetVisible}
        reminder={reminder}
        onClose={() => setReminderSheetVisible(false)}
        onReminderChanged={() => void loadThought()}
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
  scrollContent: {
    paddingHorizontal: spacing.s6,
    paddingTop: spacing.s6,
    paddingBottom: spacing.s8,
    gap: spacing.s4,
  },
  bodyText: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  bodyInput: {
    ...typography.bodyLg,
    color: colors.onSurface,
    minHeight: 120,
    textAlignVertical: "top",
  },
  topicsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  timestampText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
  },
  errorText: {
    ...typography.bodyLg,
    color: colors.error,
    textAlign: "center",
  },
  headerButtons: {
    flexDirection: "row",
    gap: spacing.s2,
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: spacing.s2,
    paddingVertical: 4,
  },
  headerButtonPressed: {
    opacity: 0.5,
  },
  headerButtonText: {
    ...typography.bodyLg,
    color: colors.primary,
  },
  headerButtonSave: {
    fontFamily: "Manrope_600SemiBold",
  },
  headerButtonDelete: {
    color: colors.error,
  },
  reminderPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    minHeight: 48,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s2,
    marginTop: spacing.s2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  reminderPromptRowPressed: {
    opacity: 0.85,
  },
  reminderPromptText: {
    ...typography.bodyLg,
    color: colors.onSurface,
    flex: 1,
  },
});
