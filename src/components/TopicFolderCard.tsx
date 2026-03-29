import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
import { topicFolderIconName } from "@/lib/topicFolderIcon";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface TopicFolderCardProps {
  id: string;
  name: string;
  normalizedName: string;
  thoughtCount: number;
  onPress: () => void;
  onEdit?: () => void;
  muted?: boolean;
}

export function TopicFolderCard({
  id,
  name,
  normalizedName,
  thoughtCount,
  onPress,
  onEdit,
  muted = false,
}: TopicFolderCardProps) {
  const iconName = topicFolderIconName(normalizedName);
  const countLabel = `${thoughtCount} item${thoughtCount === 1 ? "" : "s"}`;

  return (
    <View style={styles.wrapper} testID={`library-topic-card-${id}`}>
      <View style={styles.tabStrip} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${countLabel}`}
        style={({ pressed }) => [
          styles.card,
          muted && styles.cardMuted,
          pressed && styles.cardPressed,
        ]}
      >
        <View
          style={[styles.iconCircle, muted && styles.iconCircleMuted]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialCommunityIcons
            name={iconName}
            size={28}
            color={muted ? colors.secondary : colors.primary}
          />
        </View>
        {onEdit ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={({ pressed }) => [
              styles.editBtn,
              pressed && styles.editBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${name}`}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={colors.secondary}
            />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </Text>
        <Text style={styles.count}>{countLabel}</Text>
        <View style={styles.chevronRow}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.outline}
          />
        </View>
      </Pressable>
    </View>
  );
}

const TAB_H = 12;

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginHorizontal: spacing.s2,
    marginTop: TAB_H + spacing.s2,
    marginBottom: spacing.s6,
  },
  tabStrip: {
    position: "absolute",
    top: -TAB_H,
    left: 0,
    width: "40%",
    height: TAB_H,
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    zIndex: 1,
  },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.xl,
    borderTopLeftRadius: 0,
    padding: spacing.s12,
    paddingTop: spacing.s8,
    minHeight: 200,
    justifyContent: "space-between",
    ...shadows.card,
  },
  cardMuted: {
    opacity: 0.85,
  },
  cardPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.s8,
  },
  iconCircleMuted: {
    opacity: 0.9,
  },
  title: {
    ...typography.headlineMd,
    fontSize: 22,
    lineHeight: 28,
    color: colors.onSurface,
    marginBottom: spacing.s2,
  },
  count: {
    ...typography.labelMd,
    fontSize: 13,
    color: colors.secondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  chevronRow: {
    marginTop: spacing.s12,
    alignItems: "flex-end",
  },
  editBtn: {
    position: "absolute",
    top: spacing.s8,
    right: spacing.s8,
    padding: spacing.s2,
  },
  editBtnPressed: {
    opacity: 0.5,
  },
});
