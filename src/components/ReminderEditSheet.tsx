/**
 * Bottom sheet for reviewing (**inactive**) or rescheduling (**active**) a single reminder.
 */
import { Button } from "@/components/Button";
import {
  addReminderToDeviceCalendar,
  addToCalendarSuccessCopy,
} from "@/lib/deviceCalendar";
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
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useLayoutEffect, useState } from "react";
import {
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

const MAX_REMINDER_TEXT_LENGTH = 500;

type DatePickerStep = "date" | "time";

interface DatePickerState {
  currentDate: Date;
  step: DatePickerStep;
}

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

export interface ReminderEditSheetProps {
  visible: boolean;
  /** `inactive` (review / approve) or `active` (reschedule). */
  reminder: Reminder | null;
  onClose: () => void;
  onReminderChanged: () => void;
}

export function ReminderEditSheet({
  visible,
  reminder,
  onClose,
  onReminderChanged,
}: ReminderEditSheetProps) {
  const [working, setWorking] = useState<Reminder | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedDate, setEditedDate] = useState(new Date());
  const [pickerState, setPickerState] = useState<DatePickerState | null>(null);
  const [pastDateError, setPastDateError] = useState(false);
  const [snippetError, setSnippetError] = useState(false);
  const [addingCalendar, setAddingCalendar] = useState(false);

  const show =
    visible &&
    reminder !== null &&
    (reminder.status === "active" || reminder.status === "inactive");

  useLayoutEffect(() => {
    if (show && reminder) {
      setWorking(reminder);
      setEditedText(reminder.extracted_text);
      setEditedDate(new Date(reminder.scheduled_at));
      setPastDateError(false);
      setSnippetError(false);
      setPickerState(null);
    }
  }, [show, reminder]);

  const effective = working ?? reminder;
  const isInactive = effective?.status === "inactive";
  const isActive = effective?.status === "active";

  useEffect(() => {
    if (!visible) {
      setPickerState(null);
      setWorking(null);
    }
  }, [visible]);

  const openPicker = () => {
    setPickerState({ currentDate: editedDate, step: "date" });
    setPastDateError(false);
  };

  const handlePickerChange = (_: unknown, selected?: Date) => {
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
        setEditedDate(merged);
        setPickerState(null);
      }
    } else {
      setPickerState({ ...pickerState, currentDate: selected });
    }
  };

  const confirmIosPicker = () => {
    if (!pickerState) return;
    if (pickerState.step === "date") {
      setPickerState({ ...pickerState, step: "time" });
      return;
    }
    setEditedDate(pickerState.currentDate);
    setPickerState(null);
  };

  async function applyApprove() {
    const row = working ?? reminder;
    if (!row || row.status !== "inactive") return;

    const bodyText = editedText.trim();
    if (!bodyText) {
      setSnippetError(true);
      return;
    }
    setSnippetError(false);

    if (editedDate <= new Date()) {
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
      scheduledAt: editedDate,
      leadTime: prefs.leadTime,
      morningTime: prefs.morningTime,
    });

    let notifId: string | null = null;
    try {
      notifId = await scheduleReminder({
        title: "Reminder",
        body: bodyText,
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
        scheduled_at: editedDate.toISOString(),
        extracted_text: bodyText,
        updated_at: now,
      })
      .eq("id", row.id);

    const next: Reminder = {
      ...row,
      status: "active",
      notification_id: notifId,
      scheduled_at: editedDate.toISOString(),
      extracted_text: bodyText,
      updated_at: now,
    };
    setWorking(next);
    onReminderChanged();

    if (Platform.OS !== "web") {
      Alert.alert(
        "Add to calendar?",
        "Save this reminder as an event in your calendar app.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Add",
            onPress: () => {
              void (async () => {
                const result = await addReminderToDeviceCalendar({
                  title: bodyText,
                  scheduledAt: editedDate,
                });
                if (result.ok) {
                  const { title, message } = addToCalendarSuccessCopy(result);
                  Alert.alert(title, message);
                } else if (result.code === "denied") {
                  Alert.alert(
                    "Calendar access needed",
                    "Allow calendar access in Settings to add this reminder.",
                  );
                } else {
                  Alert.alert("Could not add", result.message);
                }
              })();
            },
          },
        ],
        { cancelable: false },
      );
    }
  }

  async function handleAddToCalendar() {
    const row = working ?? reminder;
    if (!row || row.status !== "active") return;
    if (Platform.OS === "web") return;

    const bodyText = editedText.trim();
    if (!bodyText) {
      setSnippetError(true);
      return;
    }
    setSnippetError(false);

    setAddingCalendar(true);
    try {
      const result = await addReminderToDeviceCalendar({
        title: bodyText,
        scheduledAt: editedDate,
      });
      if (result.ok) {
        const { title, message } = addToCalendarSuccessCopy(result);
        Alert.alert(title, message);
      } else if (result.code === "denied") {
        Alert.alert(
          "Calendar access needed",
          "Allow calendar access in Settings to add this reminder.",
        );
      } else {
        Alert.alert("Could not add", result.message);
      }
    } finally {
      setAddingCalendar(false);
    }
  }

  async function applyReschedule() {
    const row = working ?? reminder;
    if (!row || row.status !== "active") return;

    const bodyText = editedText.trim();
    if (!bodyText) {
      setSnippetError(true);
      return;
    }
    setSnippetError(false);

    if (editedDate <= new Date()) {
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

    if (row.notification_id) {
      await cancelReminder(row.notification_id).catch(() => {});
    }

    const prefs = await loadUserPreferences();
    const fireDate = computeFireDate({
      scheduledAt: editedDate,
      leadTime: prefs.leadTime,
      morningTime: prefs.morningTime,
    });

    let notifId: string | null = null;
    try {
      notifId = await scheduleReminder({
        title: "Reminder",
        body: bodyText,
        fireDate,
      });
    } catch {
      // non-fatal
    }

    const now = new Date().toISOString();
    await supabase
      .from("reminders")
      .update({
        notification_id: notifId,
        scheduled_at: editedDate.toISOString(),
        extracted_text: bodyText,
        updated_at: now,
      })
      .eq("id", row.id);

    const next: Reminder = {
      ...row,
      notification_id: notifId,
      scheduled_at: editedDate.toISOString(),
      extracted_text: bodyText,
      updated_at: now,
    };
    setWorking(next);
    onReminderChanged();
  }

  async function handleDismiss() {
    const row = working ?? reminder;
    if (!row) return;

    if (row.notification_id) {
      await cancelReminder(row.notification_id).catch(() => {});
    }

    await supabase
      .from("reminders")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", row.id);

    onReminderChanged();
    onClose();
  }

  const isPastDate = editedDate <= new Date();

  return (
    <>
      <Modal
        visible={show}
        animationType="slide"
        transparent
        onRequestClose={onClose}
        accessibilityViewIsModal
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close reminder editor"
        >
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
          >
            <View style={styles.titleRow}>
              <Text
                style={styles.title}
                accessibilityRole="header"
                nativeID="reminder-edit-sheet-title"
              >
                {isInactive ? "Review reminder" : "Scheduled reminder"}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.microLabel}>Reminder text</Text>
              <TextInput
                style={styles.snippetInput}
                value={editedText}
                onChangeText={(t) => {
                  setEditedText(t);
                  if (snippetError && t.trim()) setSnippetError(false);
                }}
                multiline
                maxLength={MAX_REMINDER_TEXT_LENGTH}
                placeholder="What should the notification say?"
                placeholderTextColor={colors.outlineVariant}
                accessibilityLabel="Edit reminder notification text"
              />
              {snippetError && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  Add a short description for this reminder
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.dateRow,
                  pressed && styles.dateRowPressed,
                ]}
                onPress={openPicker}
                accessibilityRole="button"
                accessibilityLabel={`Reminder time: ${formatReminderDate(editedDate)}. Tap to change.`}
                accessibilityHint="Opens date and time picker"
              >
                <Text style={styles.dateText}>
                  {formatReminderDate(editedDate)}
                </Text>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={colors.outlineVariant}
                />
              </Pressable>

              {pastDateError && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  Choose a future date and time
                </Text>
              )}

              <View style={styles.actionRow}>
                {isInactive ? (
                  <>
                    <Button
                      label="Approve"
                      variant="primary"
                      onPress={() => void applyApprove()}
                      style={styles.actionBtn}
                      disabled={isPastDate}
                    />
                    <Button
                      label="Dismiss"
                      variant="secondary"
                      onPress={() => void handleDismiss()}
                      style={styles.actionBtn}
                    />
                  </>
                ) : (
                  isActive && (
                    <>
                      <Button
                        label="Save"
                        variant="primary"
                        onPress={() => void applyReschedule()}
                        style={styles.actionBtn}
                        disabled={isPastDate}
                      />
                      <Button
                        label="Dismiss"
                        variant="secondary"
                        onPress={() => void handleDismiss()}
                        style={styles.actionBtn}
                      />
                    </>
                  )
                )}
              </View>

              {isActive && Platform.OS !== "web" && (
                <Button
                  label={addingCalendar ? "Adding…" : "Add to calendar"}
                  variant="secondary"
                  onPress={() => void handleAddToCalendar()}
                  style={styles.calendarBtn}
                  disabled={addingCalendar || isPastDate}
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {pickerState !== null && Platform.OS === "ios" && show && (
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

      {pickerState !== null && Platform.OS === "android" && show && (
        <DateTimePicker
          value={pickerState.currentDate}
          mode={pickerState.step}
          display="default"
          onChange={handlePickerChange}
          minimumDate={new Date()}
        />
      )}
    </>
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
    maxHeight: "88%",
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
    marginBottom: spacing.s4,
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.s4,
    paddingBottom: spacing.s4,
  },
  microLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
  },
  snippetInput: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.sm,
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
  errorText: {
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
  calendarBtn: {
    alignSelf: "stretch",
    marginTop: spacing.s2,
  },
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
