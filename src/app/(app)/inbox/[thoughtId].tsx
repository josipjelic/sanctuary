import { Button, Topic } from "@/components";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import {
  cancelReminder,
  computeFireDate,
  requestNotificationPermission,
  scheduleReminder,
} from "@/lib/notifications";
import type { LeadTime } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Reminder } from "@/types/reminder";
import type { Thought } from "@/types/thought";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

type DatePickerStep = "date" | "time";

interface DatePickerState {
  currentDate: Date;
  step: DatePickerStep;
}

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
      "id, thought_id, extracted_text, scheduled_at, status, notification_id, lead_time, created_at, updated_at",
    )
    .eq("thought_id", thoughtId)
    .in("status", ["inactive", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Reminder | null) ?? null;
}

async function loadUserPreferences(): Promise<{
  leadTime: LeadTime;
  morningTime: string;
}> {
  const { data } = await supabase
    .from("user_preferences")
    .select("key, value")
    .in("key", ["notification_lead_time", "morning_notification_time"]);

  let leadTime: LeadTime = "15min";
  let morningTime = "07:30";

  for (const row of data ?? []) {
    if (row.key === "notification_lead_time") {
      leadTime = (row.value as string) as LeadTime;
    } else if (row.key === "morning_notification_time") {
      morningTime = row.value as string;
    }
  }
  return { leadTime, morningTime };
}

/** Format a Date as "Tuesday, 8 April · 14:00" */
function formatReminderDate(d: Date): string {
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${dayName}, ${dayNum} ${month} · ${hours}:${mins}`;
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
  const [editedReminderDate, setEditedReminderDate] = useState<Date>(
    new Date(),
  );
  const [pickerState, setPickerState] = useState<DatePickerState | null>(null);
  const [pastDateError, setPastDateError] = useState(false);

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
      if (reminderData) {
        setEditedReminderDate(new Date(reminderData.scheduled_at));
      }
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
  // Reminder actions
  // ---------------------------------------------------------------------------

  function openReminderDatePicker() {
    setPickerState({ currentDate: editedReminderDate, step: "date" });
    setPastDateError(false);
  }

  function handlePickerChange(_: unknown, selected?: Date) {
    if (!pickerState) return;

    if (!selected) {
      setPickerState(null);
      return;
    }

    if (Platform.OS === "android") {
      if (pickerState.step === "date") {
        setPickerState({ currentDate: selected, step: "time" });
      } else {
        const merged = new Date(pickerState.currentDate);
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setEditedReminderDate(merged);
        setPickerState(null);
      }
    } else {
      setPickerState({ ...pickerState, currentDate: selected });
    }
  }

  function confirmIosPicker() {
    if (!pickerState) return;
    if (pickerState.step === "date") {
      setPickerState({ ...pickerState, step: "time" });
      return;
    }
    setEditedReminderDate(pickerState.currentDate);
    setPickerState(null);
  }

  async function handleApproveReminder() {
    if (!reminder) return;

    if (editedReminderDate <= new Date()) {
      setPastDateError(true);
      return;
    }
    setPastDateError(false);

    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert(
        "Notifications disabled",
        "Enable notifications in Settings to schedule this reminder.",
      );
      return;
    }

    const prefs = await loadUserPreferences();
    const fireDate = computeFireDate({
      scheduledAt: editedReminderDate,
      leadTime: prefs.leadTime,
      morningTime: prefs.morningTime,
    });

    let notifId: string | null = null;
    try {
      notifId = await scheduleReminder({
        title: "Reminder",
        body: reminder.extracted_text,
        fireDate,
      });
    } catch {
      // non-fatal
    }

    const now = new Date().toISOString();
    await supabase
      .from("reminders")
      .update({
        status: "active",
        notification_id: notifId,
        scheduled_at: editedReminderDate.toISOString(),
        updated_at: now,
      })
      .eq("id", reminder.id);

    setReminder((prev) =>
      prev
        ? {
            ...prev,
            status: "active",
            notification_id: notifId,
            scheduled_at: editedReminderDate.toISOString(),
            updated_at: now,
          }
        : prev,
    );
  }

  async function handleRescheduleReminder() {
    if (!reminder) return;

    if (reminder.notification_id) {
      await cancelReminder(reminder.notification_id).catch(() => {});
    }

    await handleApproveReminder();
  }

  async function handleDismissReminder() {
    if (!reminder) return;

    if (reminder.notification_id) {
      await cancelReminder(reminder.notification_id).catch(() => {});
    }

    await supabase
      .from("reminders")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", reminder.id);

    setReminder(null);
  }

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

  const isPastDate = editedReminderDate <= new Date();

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
          <View
            style={styles.reminderCard}
            accessible
            accessibilityLabel="Reminder"
          >
            <Text style={styles.reminderLabel}>REMINDER</Text>

            <View style={styles.snippetBlock}>
              <Text
                style={styles.snippetText}
                numberOfLines={2}
                accessibilityLabel={`Extracted text: ${reminder.extracted_text}`}
              >
                {reminder.extracted_text}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.dateRow,
                pressed && styles.dateRowPressed,
              ]}
              onPress={openReminderDatePicker}
              accessibilityRole="button"
              accessibilityLabel={`Reminder time: ${formatReminderDate(editedReminderDate)}. Tap to change.`}
              accessibilityHint="Opens date and time picker"
            >
              <Text style={styles.dateText}>
                {formatReminderDate(editedReminderDate)}
              </Text>
              <Ionicons
                name="pencil-outline"
                size={16}
                color={colors.outlineVariant}
              />
            </Pressable>

            {pastDateError && (
              <Text
                style={styles.pastDateError}
                accessibilityRole="alert"
              >
                Choose a future date and time
              </Text>
            )}

            <View style={styles.actionRow}>
              {reminder.status === "inactive" ? (
                <>
                  <Button
                    label="Approve"
                    variant="primary"
                    onPress={() => void handleApproveReminder()}
                    style={styles.actionBtn}
                    disabled={isPastDate}
                  />
                  <Button
                    label="Dismiss"
                    variant="secondary"
                    onPress={() => void handleDismissReminder()}
                    style={styles.actionBtn}
                  />
                </>
              ) : (
                <>
                  <Button
                    label="Reschedule"
                    variant="primary"
                    onPress={() => void handleRescheduleReminder()}
                    style={styles.actionBtn}
                    disabled={isPastDate}
                  />
                  <Button
                    label="Dismiss"
                    variant="secondary"
                    onPress={() => void handleDismissReminder()}
                    style={styles.actionBtn}
                  />
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* iOS date/time picker — two-step modal */}
      {pickerState !== null && Platform.OS === "ios" && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setPickerState(null)}
        >
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setPickerState(null)}
            accessibilityLabel="Cancel date selection"
          >
            <Pressable
              style={styles.pickerSheet}
              onPress={(e) => e.stopPropagation()}
              accessible={false}
            >
              <Text style={styles.pickerTitle}>
                {pickerState.step === "date" ? "Select date" : "Select time"}
              </Text>
              <DateTimePicker
                value={pickerState.currentDate}
                mode={pickerState.step}
                display="spinner"
                onChange={handlePickerChange}
                minimumDate={new Date()}
              />
              <View style={styles.pickerActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setPickerState(null)}
                />
                <Button
                  label={pickerState.step === "date" ? "Next" : "Confirm"}
                  variant="primary"
                  onPress={confirmIosPicker}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Android — system dialog, no overlay */}
      {pickerState !== null && Platform.OS === "android" && (
        <DateTimePicker
          value={pickerState.currentDate}
          mode={pickerState.step}
          display="default"
          onChange={handlePickerChange}
          minimumDate={new Date()}
        />
      )}
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
  // Reminder card
  reminderCard: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.lg,
    padding: spacing.s4,
    gap: spacing.s4,
  },
  reminderLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textTransform: "uppercase",
  },
  snippetBlock: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.sm,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s4,
  },
  snippetText: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.s2,
  },
  dateRowPressed: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  dateText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 26,
    color: colors.onSurface,
    flex: 1,
  },
  pastDateError: {
    ...typography.labelMd,
    color: colors.error,
    marginTop: -spacing.s2,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.s4,
  },
  actionBtn: {
    flex: 1,
  },
  // Date/time picker (iOS modal)
  pickerBackdrop: {
    flex: 1,
    backgroundColor: `${colors.onSurface}66`,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
    gap: spacing.s4,
  },
  pickerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s2,
  },
  pickerActions: {
    flexDirection: "row",
    gap: spacing.s4,
    marginTop: spacing.s4,
  },
});
