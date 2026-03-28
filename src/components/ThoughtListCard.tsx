import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { colors, spacing, typography } from "@/lib/theme";
import type { ThoughtListPreview } from "@/types/thoughtList";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Card } from "./Card";
import { Topic } from "./Topic";

interface ThoughtListCardProps {
  item: ThoughtListPreview;
  style?: StyleProp<ViewStyle>;
}

export function ThoughtListCard({ item, style }: ThoughtListCardProps) {
  const isPending =
    item.transcription_status === "pending" || item.body.trim() === "";
  const topicPending = item.tagging_status === "pending";

  return (
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

      <Text style={styles.timestampText}>
        {formatRelativeTime(item.created_at)}
      </Text>
    </Card>
  );
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
  timestampText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginTop: spacing.s2,
  },
});
