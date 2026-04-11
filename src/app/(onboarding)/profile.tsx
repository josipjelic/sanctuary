import { OceanRadarChart } from "@/components/OceanRadarChart";
import { supabase } from "@/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
import type {
  OceanDimension,
  OceanProfile,
  OceanReasoning,
} from "@/types/oceanProfile";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DimensionMeta {
  key: OceanDimension;
  label: string;
  description: string;
  color: string;
  lowLabel: string;
  highLabel: string;
}

const DIMENSIONS: DimensionMeta[] = [
  {
    key: "openness",
    label: "Openness",
    description:
      "Curiosity, imagination and openness to new ideas and experiences.",
    color: "#6C9B7D",
    lowLabel: "Practical",
    highLabel: "Imaginative",
  },
  {
    key: "conscientiousness",
    label: "Conscientiousness",
    description: "Organisation, self-discipline and goal-directed reliability.",
    color: "#5B8DB8",
    lowLabel: "Spontaneous",
    highLabel: "Organised",
  },
  {
    key: "extraversion",
    label: "Extraversion",
    description:
      "Energy from social interaction, assertiveness and positive affect.",
    color: "#C4845A",
    lowLabel: "Reflective",
    highLabel: "Outgoing",
  },
  {
    key: "agreeableness",
    label: "Agreeableness",
    description:
      "Empathy, warmth, cooperation and trust in close relationships.",
    color: "#9B7DC0",
    lowLabel: "Analytical",
    highLabel: "Empathetic",
  },
  {
    key: "neuroticism",
    label: "Neuroticism",
    description:
      "Emotional sensitivity, stress response and tendency to worry.",
    color: "#C4755A",
    lowLabel: "Calm",
    highLabel: "Sensitive",
  },
];

function scoreLabel(score: number): string {
  if (score < 0.3) return "Low";
  if (score < 0.5) return "Moderate–low";
  if (score < 0.7) return "Moderate–high";
  return "High";
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<OceanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState(false);

  const chartSize = Math.min(width - spacing.s8 * 2, 320);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function reScore() {
    if (!profile || profile.answers.length === 0) return;
    setRescoring(true);
    setRescoreError(false);
    try {
      const answeredItems = profile.answers.filter(
        (a) => a.answer.trim().length > 0,
      );
      if (answeredItems.length === 0) return;
      const { error: fnError } = await supabase.functions.invoke(
        "score-ocean-profile",
        {
          body: {
            answers: answeredItems,
            question_set_version: profile.question_set_version,
          },
        },
      );
      if (fnError) throw fnError;
      await loadProfile();
    } catch {
      setRescoreError(true);
    } finally {
      setRescoring(false);
    }
  }

  async function loadProfile() {
    setLoading(true);
    setError(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from("ocean_profiles")
        .select(
          "user_id, openness, conscientiousness, extraversion, agreeableness, neuroticism, reasoning, answers, question_set_version, scored_at",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setProfile(data as OceanProfile | null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Your Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.centred}>
            <Text style={styles.errorText}>Couldn't load your profile.</Text>
            <Pressable
              onPress={() => void loadProfile()}
              style={styles.retryButton}
            >
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : !profile ? (
          <View style={styles.centred}>
            <Ionicons
              name="person-outline"
              size={48}
              color={colors.outlineVariant}
            />
            <Text style={styles.emptyTitle}>No profile yet</Text>
            <Text style={styles.emptyBody}>
              Complete the onboarding questions to build your personality
              profile.
            </Text>
            <Pressable
              onPress={() => router.replace("/(onboarding)")}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaLabel}>Get started</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Radar chart card */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Big Five (OCEAN)</Text>
              <Text style={styles.chartSubtitle}>
                Scored {formatDate(profile.scored_at)}
              </Text>
              <View style={styles.chartWrap}>
                <OceanRadarChart
                  scores={{
                    openness: profile.openness,
                    conscientiousness: profile.conscientiousness,
                    extraversion: profile.extraversion,
                    agreeableness: profile.agreeableness,
                    neuroticism: profile.neuroticism,
                  }}
                  size={chartSize}
                />
              </View>
            </View>

            {/* Dimension score rows */}
            {DIMENSIONS.map((dim) => {
              const score = profile[dim.key];
              const pct = Math.round(score * 100);
              const aiReasoning = (
                profile.reasoning as OceanReasoning | null | undefined
              )?.[dim.key];
              return (
                <View key={dim.key} style={styles.dimCard}>
                  <View style={styles.dimHeader}>
                    <View
                      style={[styles.dimDot, { backgroundColor: dim.color }]}
                    />
                    <Text style={styles.dimLabel}>{dim.label}</Text>
                    <Text style={styles.dimScore}>{pct}%</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: dim.color },
                      ]}
                    />
                  </View>

                  <View style={styles.barEndLabels}>
                    <Text style={styles.barEndLabel}>{dim.lowLabel}</Text>
                    <Text style={[styles.dimScoreLabel, { color: dim.color }]}>
                      {scoreLabel(score)}
                    </Text>
                    <Text style={styles.barEndLabel}>{dim.highLabel}</Text>
                  </View>

                  <Text style={styles.dimDescription}>{dim.description}</Text>

                  {!!aiReasoning && (
                    <View style={styles.reasoningBox}>
                      <Text style={styles.reasoningText}>{aiReasoning}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {/* Re-evaluate with stored answers */}
              <Pressable
                onPress={() => void reScore()}
                disabled={rescoring}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonPrimary,
                  (pressed || rescoring) && styles.actionButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Re-evaluate scores using your existing answers"
              >
                {rescoring ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Ionicons
                    name="sync-outline"
                    size={16}
                    color={colors.onPrimary}
                  />
                )}
                <Text style={styles.actionLabelPrimary}>
                  {rescoring ? "Re-evaluating…" : "Re-evaluate"}
                </Text>
              </Pressable>

              {/* Record new answers */}
              <Pressable
                onPress={() => router.push("/(onboarding)")}
                disabled={rescoring}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  pressed && styles.actionButtonSecondaryPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Answer new questions to update your profile"
              >
                <Ionicons name="mic-outline" size={16} color={colors.primary} />
                <Text style={styles.actionLabelSecondary}>New answers</Text>
              </Pressable>
            </View>

            {rescoreError && (
              <Text style={styles.rescoreErrorText}>
                Re-evaluation failed — please try again.
              </Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s6,
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
  backButtonPressed: { backgroundColor: colors.surfaceContainerHigh },
  headerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 44 },

  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s8,
    gap: spacing.s4,
  },
  errorText: { ...typography.bodyLg, color: colors.error, textAlign: "center" },
  retryButton: {
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
  },
  retryLabel: {
    ...typography.labelMd,
    color: colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.s4,
  },
  emptyBody: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    lineHeight: 24,
  },
  ctaButton: {
    marginTop: spacing.s4,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  ctaLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s16,
    gap: spacing.s4,
  },

  // Chart card
  chartCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.s8,
    alignItems: "center",
    ...shadows.card,
  },
  chartTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s2,
  },
  chartSubtitle: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    marginBottom: spacing.s6,
  },
  chartWrap: { alignItems: "center" },

  // Dimension cards
  dimCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s6,
    ...shadows.card,
  },
  dimHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.s4,
    gap: spacing.s2,
  },
  dimDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  dimLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onSurface,
    flex: 1,
  },
  dimScore: {
    ...typography.labelMd,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onSurface,
    fontSize: 15,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
    marginBottom: spacing.s2,
  },
  barFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  barEndLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.s4,
  },
  barEndLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    fontSize: 11,
  },
  dimScoreLabel: {
    ...typography.labelMd,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
  },
  dimDescription: {
    ...typography.bodyLg,
    fontSize: 13,
    lineHeight: 20,
    color: colors.secondary,
  },
  reasoningBox: {
    marginTop: spacing.s4,
    paddingTop: spacing.s4,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHigh,
  },
  reasoningText: {
    ...typography.bodyLg,
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurface,
    fontStyle: "italic",
  },

  // Action buttons row
  actionsRow: {
    flexDirection: "row",
    gap: spacing.s4,
    marginTop: spacing.s4,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    paddingVertical: spacing.s4,
    borderRadius: radius.full,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonPressed: { opacity: 0.75 },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonSecondaryPressed: { backgroundColor: `${colors.primary}18` },
  actionLabelPrimary: {
    ...typography.labelMd,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onPrimary,
  },
  actionLabelSecondary: {
    ...typography.labelMd,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  rescoreErrorText: {
    ...typography.labelMd,
    color: colors.error,
    textAlign: "center",
    marginTop: spacing.s2,
  },
});
