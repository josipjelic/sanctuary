import { Card } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type UserState = {
  content: string | null;
  last_updated_at: string | null;
};

function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 2) return "Updated just now";
  if (diffMin < 60) return `Updated ${diffMin} minutes ago`;
  if (diffHours === 1) return "Updated 1 hour ago";
  if (diffHours < 24) return `Updated ${diffHours} hours ago`;
  if (diffDays === 1) return "Updated 1 day ago";
  return `Updated ${diffDays} days ago`;
}

export default function JournalProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUserState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_state")
        .select("content, last_updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        logger.error("JournalProfile: failed to load user_state", error);
        setUserState(null);
        return;
      }

      if (data) {
        setUserState({
          content: (data.content as string | null) ?? null,
          last_updated_at: (data.last_updated_at as string | null) ?? null,
        });
      } else {
        setUserState(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUserState();
  }, [loadUserState]);

  function handleRefresh() {
    setRefreshing(true);
    void loadUserState();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Your profile
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Your profile
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.introText} accessibilityRole="text">
          This is what Sanctuary has learned about you from your journal
          sessions. It helps personalise the questions you're asked.
        </Text>

        <Card
          variant="elevated"
          size="xl"
          style={styles.profileCard}
          testID="journal-profile-card"
        >
          <View accessibilityLabel="Your journal profile">
            {userState?.content ? (
              <Text style={styles.profileContent} accessibilityRole="text">
                {userState.content}
              </Text>
            ) : (
              <View style={styles.emptyProfile}>
                <Text style={styles.emptyProfileText}>
                  Complete your first journal session to start building your
                  profile.
                </Text>
              </View>
            )}
          </View>
        </Card>

        {userState?.last_updated_at && (
          <Text style={styles.lastUpdated}>
            {formatRelativeTime(userState.last_updated_at)}
          </Text>
        )}

        <Text style={styles.privacyNote} accessibilityRole="text">
          This profile is private and only used to personalise your journal
          experience.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  headerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: spacing.s8,
    paddingTop: spacing.s6,
    paddingBottom: spacing.s12,
  },
  introText: {
    ...typography.bodyLg,
    color: colors.secondary,
    lineHeight: 26,
    marginBottom: spacing.s6,
  },
  profileCard: {
    padding: spacing.s8,
  },
  profileContent: {
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 26,
  },
  emptyProfile: {
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyProfileText: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    fontStyle: "italic",
  },
  lastUpdated: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginTop: spacing.s4,
  },
  privacyNote: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    fontStyle: "italic",
    marginTop: spacing.s6,
  },
});
