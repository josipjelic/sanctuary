import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { colors, spacing, typography } from "@/lib/theme";
import type { ThoughtListPreview } from "@/types/thoughtList";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Card } from "./Card";
import { Topic } from "./Topic";

interface ThoughtListCardProps {
  item: ThoughtListPreview;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Bell icon renders in primary colour — reminder is awaiting approval. */
  hasPendingReminder?: boolean;
  /** Bell icon renders in outlineVariant colour — reminder is approved/scheduled. */
  hasApprovedReminder?: boolean;
  /**
   * Called when the user taps the timestamp/bell row.
   * Only fired when a bell icon is visible. The full-card onPress
   * still navigates to the thought detail.
   */
  onBellPress?: () => void;
}

export function ThoughtListCard({
  item,
  style,
  onPress,
  hasPendingReminder = false,
  hasApprovedReminder = false,
  onBellPress,
}: ThoughtListCardProps) {
  const isPending =
    item.transcription_status === "pending" || item.body.trim() === "";
  const topicPending = item.tagging_status === "pending";

  const showBell = hasPendingReminder || hasApprovedReminder;
  const bellColor = hasPendingReminder ? colors.primary : colors.outlineVariant;
  const bellIcon = hasPendingReminder
    ? "notifications-outline"
    : "notifications";

  const timestampLabel = showBell
    ? `${formatRelativeTime(item.created_at)}, ${hasPendingReminder ? "has a pending reminder" : "reminder scheduled"}`
    : formatRelativeTime(item.created_at);

  const card = (
    <Card style={[styles.card, style]} testID={`thought-row-${item.id}`}>
      <Text
        style={[styles.bodyText, isPending && styles.bodyTextPending]}
        numberOfLines={2}
        accessibilityLabel={isPending ? "Transcribing" : item.body}
      >
        {isPending ? "Transcribing\u2026" : item.body}
      </Text>

      {topicPending && (
        <View style={styles.topicsRow} accessibilityLabel="Assigning topic">
          <ActivityIndicator size="small" color={colors.secondary} />
        </View>
      )}
      {!topicPending && item.topics.length > 0 && (
        <View style={styles.topicsRow} accessibilityRole="list">
          {item.topics.map((topic) => (
            <Topic key={topic} label={topic} testID={`topic-${topic}`} />
          ))}
        </View>
      )}

      {showBell ? (
        <Pressable
          onPress={onBellPress}
          disabled={!onBellPress}
          style={styles.timestampRow}
          accessibilityLabel={timestampLabel}
          accessibilityRole="button"
          accessibilityHint={
            hasPendingReminder
              ? "Opens reminders review sheet"
              : hasApprovedReminder
                ? "Opens reminder sheet to reschedule or dismiss"
                : undefined
          }
        >
          <Text
            style={[styles.timestampText, styles.timestampFlex]}
            numberOfLines={1}
          >
            {formatRelativeTime(item.created_at)}
          </Text>
          <Ionicons
            name={bellIcon}
            size={16}
            color={bellColor}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      ) : (
        <Text style={styles.timestampText} accessibilityLabel={timestampLabel}>
          {formatRelativeTime(item.created_at)}
        </Text>
      )}
    </Card>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
        accessibilityRole="button"
      >
        {card}
      </Pressable>
    );
  }

  return card;
}

const styles = StyleSheet.create({
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
  topicsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.s2,
    minHeight: 44,
    paddingVertical: 4,
  },
  timestampText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginTop: spacing.s2,
  },
  timestampFlex: {
    flex: 1,
    marginTop: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
