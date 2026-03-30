import { Button } from "@/components/Button";
import {
  addReminderToDeviceCalendar,
  addToCalendarSuccessCopy,
} from "@/lib/deviceCalendar";
import type { LeadTime } from "@/lib/notifications";
import {
  cancelReminder,
  computeFireDate,
  requestNotificationPermission,
  scheduleReminder,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import type { Reminder } from "@/types/reminder";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const MAX_REMINDER_TEXT_LENGTH = 500;

interface ReminderApprovalSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after any approve or dismiss so the parent can refresh counts. */
  onApprovalChange: () => void;
}

type EditingStep = "date" | "time";

interface EditingState {
  reminderId: string;
  currentDate: Date;
  step: EditingStep;
}

/** Format a Date as "Wednesday, 8 April · 14:00" */
function formatReminderDate(d: Date): string {
  const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${dayName}, ${dayNum} ${month} · ${hours}:${mins}`;
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
      leadTime = row.value as string as LeadTime;
    } else if (row.key === "morning_notification_time") {
      morningTime = row.value as string;
    }
  }
  return { leadTime, morningTime };
}

export function ReminderApprovalSheet({
  visible,
  onClose,
  onApprovalChange,
}: ReminderApprovalSheetProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [localDates, setLocalDates] = useState<Record<string, Date>>({});
  const [localTexts, setLocalTexts] = useState<Record<string, string>>({});
  const [emptySnippetId, setEmptySnippetId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pastDateError, setPastDateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Fade animations keyed by reminder id
  const fadeAnims = useRef<Record<string, Animated.Value>>({});

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("status", "inactive")
        .order("scheduled_at", { ascending: true });
      if (error) return;

      const rows = (data ?? []) as Reminder[];
      setReminders(rows);

      // Initialise local date state, editable text, and fade animations
      const dates: Record<string, Date> = {};
      const texts: Record<string, string> = {};
      for (const r of rows) {
        dates[r.id] = new Date(r.scheduled_at);
        texts[r.id] = r.extracted_text;
        if (!fadeAnims.current[r.id]) {
          fadeAnims.current[r.id] = new Animated.Value(1);
        }
      }
      setLocalDates(dates);
      setLocalTexts(texts);
      setEmptySnippetId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void fetchReminders();
    }
  }, [visible, fetchReminders]);

  function removeItemAnimated(id: string, afterFade: () => void) {
    const anim = fadeAnims.current[id];
    if (!anim) {
      afterFade();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (!reduced) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        afterFade();
      });
    });
  }

  async function handleApprove(reminder: Reminder) {
    const bodyText = (
      localTexts[reminder.id] ?? reminder.extracted_text
    ).trim();
    if (!bodyText) {
      setEmptySnippetId(reminder.id);
      return;
    }
    setEmptySnippetId(null);

    const fireDate = localDates[reminder.id] ?? new Date(reminder.scheduled_at);

    if (fireDate <= new Date()) {
      setPastDateError("Choose a future date and time");
      return;
    }
    setPastDateError(null);

    // Request permission on first approval
    await requestNotificationPermission();

    const prefs = await loadUserPreferences();
    const computedFire = computeFireDate({
      scheduledAt: fireDate,
      leadTime: prefs.leadTime,
      morningTime: prefs.morningTime,
    });

    let notificationId: string | null = null;
    try {
      notificationId = await scheduleReminder({
        title: "Reminder",
        body: bodyText,
        fireDate: computedFire,
      });
    } catch {
      // non-fatal — still mark approved in DB
    }

    const { error } = await supabase
      .from("reminders")
      .update({
        status: "active",
        notification_id: notificationId,
        scheduled_at: fireDate.toISOString(),
        extracted_text: bodyText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reminder.id);

    if (error) {
      // Reappear with error — not currently animated back in, just keep item
      return;
    }

    const finishRemoval = () => {
      removeItemAnimated(reminder.id, () => {
        setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
        onApprovalChange();
      });
    };

    if (Platform.OS === "web") {
      finishRemoval();
      return;
    }

    Alert.alert(
      "Add to calendar?",
      "Save this reminder as an event in your calendar app.",
      [
        { text: "Not now", style: "cancel", onPress: finishRemoval },
        {
          text: "Add",
          onPress: () => {
            void (async () => {
              const result = await addReminderToDeviceCalendar({
                title: bodyText,
                scheduledAt: fireDate,
              });
              if (result.ok) {
                const { title, message } = addToCalendarSuccessCopy(result);
                Alert.alert(title, message, [
                  { text: "OK", onPress: finishRemoval },
                ]);
              } else if (result.code === "denied") {
                Alert.alert(
                  "Calendar access needed",
                  "Allow calendar access in Settings to add this reminder.",
                  [{ text: "OK", onPress: finishRemoval }],
                );
              } else {
                Alert.alert("Could not add", result.message, [
                  { text: "OK", onPress: finishRemoval },
                ]);
              }
            })();
          },
        },
      ],
      { cancelable: false },
    );
  }

  async function handleDismiss(reminder: Reminder) {
    // Cancel any existing notification if there is one
    if (reminder.notification_id) {
      await cancelReminder(reminder.notification_id).catch(() => {});
    }

    const { error } = await supabase
      .from("reminders")
      .update({
        status: "dismissed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reminder.id);

    if (error) return;

    removeItemAnimated(reminder.id, () => {
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      onApprovalChange();
    });
  }

  function openDatePicker(reminder: Reminder) {
    const current = localDates[reminder.id] ?? new Date(reminder.scheduled_at);
    setEditing({ reminderId: reminder.id, currentDate: current, step: "date" });
    setPastDateError(null);
  }

  function handleDateChange(_: unknown, selected?: Date) {
    if (!editing) return;

    if (!selected) {
      // User cancelled (Android)
      setEditing(null);
      return;
    }

    if (Platform.OS === "android") {
      if (editing.step === "date") {
        // Move immediately to time step
        setEditing({ ...editing, currentDate: selected, step: "time" });
      } else {
        // Merge date part from editing.currentDate with new time
        const merged = new Date(editing.currentDate);
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setLocalDates((prev) => ({
          ...prev,
          [editing.reminderId]: merged,
        }));
        setEditing(null);
      }
    } else {
      // iOS — keep updating state while spinner turns
      setEditing({ ...editing, currentDate: selected });
    }
  }

  function confirmIosPicker() {
    if (!editing) return;
    if (editing.step === "date") {
      // Move to time selection
      setEditing({ ...editing, step: "time" });
      return;
    }
    // Commit
    setLocalDates((prev) => ({
      ...prev,
      [editing.reminderId]: editing.currentDate,
    }));
    setEditing(null);
  }

  const isEmpty = !loading && reminders.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close reminders sheet"
      >
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
        >
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text
              style={styles.title}
              accessibilityRole="header"
              nativeID="reminder-sheet-title"
            >
              Reminders to review
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close reminders sheet"
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          {/* Content */}
          {isEmpty ? (
            <View
              style={styles.emptyState}
              accessibilityRole="text"
              accessibilityLabel="All reminders reviewed, none remaining"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color={colors.primaryContainer}
              />
              <Text style={styles.emptyHeading}>All caught up</Text>
              <Text style={styles.emptyBody}>
                No reminders waiting for your review.
              </Text>
              <Button
                label="Close"
                variant="secondary"
                onPress={onClose}
                style={styles.emptyCloseBtn}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {reminders.map((reminder) => {
                const fadeAnim =
                  fadeAnims.current[reminder.id] ?? new Animated.Value(1);
                const displayDate =
                  localDates[reminder.id] ?? new Date(reminder.scheduled_at);

                return (
                  <Animated.View
                    key={reminder.id}
                    style={[styles.item, { opacity: fadeAnim }]}
                  >
                    {/* Section A: Extracted text */}
                    <Text style={styles.itemMicroLabel}>
                      Detected in your thought
                    </Text>
                    <TextInput
                      style={styles.snippetInput}
                      value={localTexts[reminder.id] ?? reminder.extracted_text}
                      onChangeText={(t) => {
                        setLocalTexts((prev) => ({
                          ...prev,
                          [reminder.id]: t,
                        }));
                        if (emptySnippetId === reminder.id && t.trim()) {
                          setEmptySnippetId(null);
                        }
                      }}
                      multiline
                      maxLength={MAX_REMINDER_TEXT_LENGTH}
                      placeholder="What should the notification say?"
                      placeholderTextColor={colors.outlineVariant}
                      accessibilityLabel="Edit reminder notification text"
                    />
                    {emptySnippetId === reminder.id && (
                      <Text style={styles.dateError} accessibilityRole="alert">
                        Add a short description for this reminder
                      </Text>
                    )}

                    {/* Section B: Date/time row */}
                    <Text style={styles.itemMicroLabel}>
                      Suggested reminder
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.dateRow,
                        pressed && styles.dateRowPressed,
                      ]}
                      onPress={() => openDatePicker(reminder)}
                      accessibilityRole="button"
                      accessibilityLabel={`Reminder time: ${formatReminderDate(displayDate)}. Tap to change.`}
                      accessibilityHint="Opens date and time picker"
                    >
                      <Text style={styles.dateText}>
                        {formatReminderDate(displayDate)}
                      </Text>
                      <Ionicons
                        name="pencil-outline"
                        size={16}
                        color={colors.secondary}
                      />
                    </Pressable>

                    {pastDateError && (
                      <Text style={styles.dateError} accessibilityRole="alert">
                        {pastDateError}
                      </Text>
                    )}

                    {/* Section C: Actions */}
                    <View style={styles.actionRow}>
                      <Button
                        label="Approve"
                        variant="primary"
                        onPress={() => void handleApprove(reminder)}
                        style={styles.actionBtn}
                      />
                      <Button
                        label="Dismiss"
                        variant="secondary"
                        onPress={() => void handleDismiss(reminder)}
                        style={styles.actionBtn}
                      />
                    </View>
                  </Animated.View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>

      {/* iOS date/time picker overlay */}
      {editing !== null && Platform.OS === "ios" && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setEditing(null)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setEditing(null)}
            accessibilityLabel="Cancel date selection"
          >
            <Pressable
              style={styles.pickerSheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.pickerTitle}>
                {editing.step === "date" ? "Select date" : "Select time"}
              </Text>
              <DateTimePicker
                value={editing.currentDate}
                mode={editing.step}
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
              <View style={styles.pickerActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setEditing(null)}
                />
                <Button
                  label={editing.step === "date" ? "Next" : "Confirm"}
                  variant="primary"
                  onPress={confirmIosPicker}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Android date/time picker — system dialog, no overlay needed */}
      {editing !== null && Platform.OS === "android" && (
        <DateTimePicker
          value={editing.currentDate}
          mode={editing.step}
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: `${colors.onSurface}66`,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
    maxHeight: "85%",
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.s6,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    paddingRight: spacing.s4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.s4,
    paddingBottom: spacing.s4,
  },
  item: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s6,
    gap: spacing.s4,
  },
  itemMicroLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
  },
  snippetInput: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s4,
    minHeight: 56,
    textAlignVertical: "top",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s2,
  },
  dateRowPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  dateText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 26,
    color: colors.onSurface,
    flex: 1,
  },
  dateError: {
    ...typography.labelMd,
    color: colors.error,
    marginTop: -spacing.s2,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.s4,
    marginTop: spacing.s2,
  },
  actionBtn: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.s8,
    gap: spacing.s2,
  },
  emptyHeading: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.s4,
  },
  emptyBody: {
    ...typography.bodyLg,
    color: colors.outlineVariant,
    textAlign: "center",
  },
  emptyCloseBtn: {
    marginTop: spacing.s8,
    minWidth: 120,
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
