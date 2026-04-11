import { Button } from "@/components";
import { logger } from "@/lib/logger";
import { OCEAN_QUESTIONS_V1 } from "@/lib/oceanOnboarding";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
import type { OceanAnswer } from "@/types/oceanProfile";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import type { RecordingOptions } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".m4a",
  sampleRate: Platform.OS === "ios" ? 44100 : 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac", sampleRate: 16000 },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
};

type VoiceState = "idle" | "recording" | "transcribing" | "error";
type ScreenState = "question" | "optional-transition";

const QUESTIONS = OCEAN_QUESTIONS_V1;
const REQUIRED_COUNT = QUESTIONS.filter((q) => q.required).length;

export default function OnboardingQuestionsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [screenState, setScreenState] = useState<ScreenState>("question");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [showTextInput, setShowTextInput] = useState(false);

  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const ringAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const question = QUESTIONS[currentIndex];
  const currentAnswer = answers[question?.id ?? 0] ?? "";
  const isRequired = question?.required ?? true;
  const isLastRequired = currentIndex === REQUIRED_COUNT - 1;
  const isOptionalQuestion = !isRequired;
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;

  const micSize = Math.min(148, Math.round(screenWidth * 0.38));
  const micIconSize = Math.round(micSize * 0.3);

  const continueLabel =
    screenState === "optional-transition"
      ? "Share more"
      : isLastRequired
        ? "Finish"
        : isLastQuestion
          ? "Finish"
          : "Continue";

  const questionLabel = isOptionalQuestion
    ? "Optional"
    : `${currentIndex + 1} of ${REQUIRED_COUNT}`;

  const stepperLabel =
    currentIndex < REQUIRED_COUNT
      ? `Question ${currentIndex + 1} of ${REQUIRED_COUNT}`
      : `Optional question ${currentIndex - REQUIRED_COUNT + 1} of ${QUESTIONS.length - REQUIRED_COUNT}`;

  // ── Accessibility ──────────────────────────────────────────────────────────
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
  }, []);

  // ── Pulse ring (idle) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;
    ringAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    ringAnimation.current.start();
    return () => {
      ringAnimation.current?.stop();
    };
  }, [ringScale, reducedMotion]);

  // ── Pulse opacity (recording) ──────────────────────────────────────────────
  useEffect(() => {
    if (voiceState === "recording" && !reducedMotion) {
      pulseAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.current.start();
    } else {
      pulseAnimation.current?.stop();
      pulseOpacity.setValue(1);
    }
  }, [voiceState, pulseOpacity, reducedMotion]);

  // ── When moving to a new question, reset text input visibility ─────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on question/state change
  useEffect(() => {
    setShowTextInput(false);
  }, [currentIndex, screenState]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  function animateSlide(direction: "forward" | "backward", onDone: () => void) {
    if (reducedMotion) {
      onDone();
      return;
    }
    const exitTo = direction === "forward" ? -screenWidth : screenWidth;
    const enterFrom = direction === "forward" ? screenWidth : -screenWidth;
    const easing = Easing.bezier(0.4, 0, 0.2, 1);
    Animated.timing(slideAnim, {
      toValue: exitTo,
      duration: 250,
      easing,
      useNativeDriver: true,
    }).start(() => {
      onDone();
      slideAnim.setValue(enterFrom);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        easing,
        useNativeDriver: true,
      }).start();
    });
  }

  function handleContinue() {
    if (screenState === "optional-transition") {
      animateSlide("forward", () => setCurrentIndex(REQUIRED_COUNT));
      setScreenState("question");
      return;
    }
    if (isLastRequired) {
      animateSlide("forward", () => setScreenState("optional-transition"));
      return;
    }
    if (isLastQuestion) {
      navigateToScoring();
      return;
    }
    animateSlide("forward", () => setCurrentIndex((prev) => prev + 1));
  }

  function handleBack() {
    if (screenState === "optional-transition") {
      animateSlide("backward", () => setScreenState("question"));
      return;
    }
    if (currentIndex === 0) return;
    animateSlide("backward", () => setCurrentIndex((prev) => prev - 1));
  }

  function navigateToScoring() {
    const answersArray: OceanAnswer[] = QUESTIONS.map((q) => ({
      question: q.text,
      answer: answers[q.id] ?? "",
    }));
    router.push({
      pathname: "/(onboarding)/scoring",
      params: { answers: JSON.stringify(answersArray) },
    });
  }

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function handleMicPress() {
    if (voiceState === "recording") {
      await stopAndTranscribe();
    } else if (voiceState !== "transcribing") {
      // Clear previous answer and collapse text input on re-record
      setShowTextInput(false);
      await startVoiceRecording();
    }
  }

  async function startVoiceRecording() {
    setVoiceState("recording");
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        setVoiceState("idle");
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      logger.error("onboarding: failed to start voice recording", err);
      setVoiceState("error");
    }
  }

  async function stopAndTranscribe() {
    setVoiceState("transcribing");
    try {
      await audioRecorder.stop();
    } catch {
      setVoiceState("error");
      return;
    }
    const uri = audioRecorder.uri;
    if (!uri) {
      setVoiceState("idle");
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        interruptionMode: "mixWithOthers",
      });
    } catch {
      /* non-fatal */
    }
    try {
      const transcript = await transcribeAnswerAudio(uri);
      if (transcript) {
        setAnswers((prev) => ({ ...prev, [question.id]: transcript }));
      }
      setVoiceState("idle");
    } catch (err) {
      logger.error("onboarding: transcribe-answer failed", err);
      setVoiceState("error");
    }
  }

  async function transcribeAnswerAudio(uri: string): Promise<string> {
    const filename = uri.split("/").pop()?.split("?")[0] ?? "recording.m4a";
    const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
    const endpoint = `${supabaseUrl}/functions/v1/transcribe-answer`;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const formData = new FormData();
    if (Platform.OS === "web") {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append(
        "audio",
        new File([blob], filename, { type: blob.type || mimeType }),
      );
    } else {
      formData.append("audio", {
        uri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);
    }
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${accessToken ?? supabaseAnonKey}`,
      );
      xhr.setRequestHeader("apikey", supabaseAnonKey);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const body = JSON.parse(xhr.responseText) as { text?: string };
          resolve(body.text ?? "");
        } else {
          reject(
            new Error(
              `transcribe-answer HTTP ${xhr.status}: ${xhr.responseText.slice(0, 300)}`,
            ),
          );
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    });
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const isRecording = voiceState === "recording";
  const isTranscribing = voiceState === "transcribing";
  const isDisabled = isTranscribing;
  const showBackButton =
    screenState === "optional-transition" ||
    (screenState === "question" && currentIndex > 0);

  // Mic status label
  const micLabel = isRecording
    ? "Tap to finish"
    : isTranscribing
      ? "Transcribing…"
      : voiceState === "error"
        ? "Something went wrong — tap to try again"
        : currentAnswer
          ? "Tap to re-record"
          : "Tap to speak";

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Header: back button + progress stepper */}
          <View style={styles.header}>
            {showBackButton ? (
              <Pressable
                onPress={() => {
                  void AccessibilityInfo.isReduceMotionEnabled().then(
                    (reduced) => {
                      if (!reduced)
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                      handleBack();
                    },
                  );
                }}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go back to previous question"
                testID="question-back"
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            ) : (
              <View style={styles.backButtonPlaceholder} />
            )}

            <View
              style={styles.stepper}
              accessibilityLabel={stepperLabel}
              accessible
            >
              {QUESTIONS.map((q, idx) => {
                const isActive =
                  screenState === "optional-transition"
                    ? idx === REQUIRED_COUNT
                    : idx === currentIndex;
                const isCompleted =
                  screenState === "optional-transition"
                    ? idx < REQUIRED_COUNT
                    : idx < currentIndex;
                const isOptional = !q.required;
                const dotOpacity =
                  isOptional &&
                  idx > currentIndex &&
                  screenState !== "optional-transition"
                    ? 0.4
                    : 1;
                return (
                  <View
                    key={q.id}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[
                      styles.dot,
                      isActive && styles.dotActive,
                      isCompleted && styles.dotCompleted,
                      !isActive && !isCompleted && styles.dotUpcoming,
                      { opacity: dotOpacity },
                    ]}
                  />
                );
              })}
            </View>

            {/* Right spacer — mirrors back button width for centred dots */}
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
              {screenState === "optional-transition" ? (
                /* ── Optional-questions transition card ── */
                <View style={styles.transitionCardInner}>
                  <Ionicons
                    name="sparkles-outline"
                    size={32}
                    color={colors.primary}
                    style={styles.transitionIcon}
                  />
                  <Text style={styles.transitionHeadline}>
                    Two more if you'd like to share.
                  </Text>
                  <Text style={styles.transitionBody}>
                    Or skip straight to your sanctuary — your profile is already
                    forming.
                  </Text>
                </View>
              ) : (
                <>
                  {/* ── Question card ── */}
                  <View style={styles.questionCard}>
                    <Text style={styles.questionLabel}>{questionLabel}</Text>
                    <Text style={styles.questionText}>{question.text}</Text>
                  </View>

                  {/* ── Hero mic button ── */}
                  <View style={styles.micSection}>
                    <View
                      style={[
                        styles.micStack,
                        { width: micSize + 72, height: micSize + 72 },
                      ]}
                    >
                      {/* Ambient glow */}
                      <View
                        style={[
                          styles.micGlow,
                          {
                            width: micSize + 40,
                            height: micSize + 40,
                            borderRadius: (micSize + 40) / 2,
                          },
                        ]}
                      />
                      {/* Pulse ring — hidden while recording */}
                      {!isRecording && (
                        <Animated.View
                          style={[
                            styles.micPulseRing,
                            {
                              width: micSize + 20,
                              height: micSize + 20,
                              borderRadius: (micSize + 20) / 2,
                              transform: [{ scale: ringScale }],
                            },
                          ]}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                      )}
                      {/* Button */}
                      <Animated.View style={{ opacity: pulseOpacity }}>
                        <Pressable
                          onPress={() => void handleMicPress()}
                          disabled={isDisabled}
                          style={[
                            styles.micMain,
                            {
                              width: micSize,
                              height: micSize,
                              borderRadius: micSize / 2,
                            },
                            isRecording && styles.micMainRecording,
                            isDisabled && styles.micMainDisabled,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isRecording
                              ? "Stop recording"
                              : isTranscribing
                                ? "Transcribing your answer"
                                : "Start voice recording"
                          }
                          testID={`question-mic-${question.id}`}
                        >
                          {isTranscribing ? (
                            <ActivityIndicator
                              color={colors.onPrimary}
                              size="large"
                            />
                          ) : isRecording ? (
                            <Ionicons
                              name="stop"
                              size={micIconSize}
                              color={colors.onPrimary}
                            />
                          ) : (
                            <Ionicons
                              name="mic"
                              size={micIconSize}
                              color={colors.onPrimary}
                            />
                          )}
                        </Pressable>
                      </Animated.View>
                    </View>

                    {/* Mic status label */}
                    <Text
                      style={[
                        styles.micLabel,
                        voiceState === "error" && styles.micLabelError,
                        isRecording && styles.micLabelRecording,
                      ]}
                    >
                      {micLabel}
                    </Text>
                  </View>

                  {/* ── Transcribed/typed answer display ── */}
                  {currentAnswer !== "" && !showTextInput && (
                    <View style={styles.answerCard}>
                      <Text style={styles.answerText} numberOfLines={6}>
                        {currentAnswer}
                      </Text>
                      <Pressable
                        onPress={() => {
                          void AccessibilityInfo.isReduceMotionEnabled().then(
                            (reduced) => {
                              if (!reduced)
                                LayoutAnimation.configureNext(
                                  LayoutAnimation.Presets.easeInEaseOut,
                                );
                              setShowTextInput(true);
                              setTimeout(() => inputRef.current?.focus(), 150);
                            },
                          );
                        }}
                        style={({ pressed }) => [
                          styles.editButton,
                          pressed && styles.editButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Edit your answer"
                        testID={`question-edit-${question.id}`}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.editButtonLabel}>Edit</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* ── Text input (secondary, shown on demand) ── */}
                  {showTextInput && (
                    <View style={styles.textInputContainer}>
                      <TextInput
                        ref={inputRef}
                        value={currentAnswer}
                        onChangeText={(text) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: text,
                          }))
                        }
                        placeholder="Your thoughts…"
                        placeholderTextColor={colors.outlineVariant}
                        multiline
                        textAlignVertical="top"
                        style={styles.textInput}
                        accessibilityLabel={`Type your answer to: ${question.text}`}
                        accessibilityHint="Your answer is private and will not be shared"
                        testID={`question-input-${question.id}`}
                      />
                    </View>
                  )}

                  {/* ── "Or type instead" link ── */}
                  {!showTextInput &&
                    currentAnswer === "" &&
                    voiceState === "idle" && (
                      <Pressable
                        onPress={() => {
                          void AccessibilityInfo.isReduceMotionEnabled().then(
                            (reduced) => {
                              if (!reduced)
                                LayoutAnimation.configureNext(
                                  LayoutAnimation.Presets.easeInEaseOut,
                                );
                              setShowTextInput(true);
                              setTimeout(() => inputRef.current?.focus(), 150);
                            },
                          );
                        }}
                        style={({ pressed }) => [
                          styles.typeInsteadButton,
                          pressed && styles.typeInsteadButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Type your answer instead"
                        testID={`question-type-instead-${question.id}`}
                      >
                        <Text style={styles.typeInsteadText}>
                          Or type instead
                        </Text>
                      </Pressable>
                    )}

                  {/* ── Continue button ── */}
                  <View style={styles.continueRow}>
                    <Button
                      label={continueLabel}
                      variant="primary"
                      onPress={handleContinue}
                      testID="question-continue"
                    />
                  </View>
                </>
              )}

              {/* ── Continue + Skip (optional-transition) ── */}
              {screenState === "optional-transition" && (
                <View style={styles.continueRow}>
                  <Pressable
                    onPress={navigateToScoring}
                    style={styles.skipLink}
                    accessibilityRole="button"
                    accessibilityLabel="Skip optional questions and go to your sanctuary"
                    testID="question-skip"
                  >
                    <Text style={styles.skipText}>Skip to my sanctuary →</Text>
                  </Pressable>
                  <Button
                    label={continueLabel}
                    variant="primary"
                    onPress={handleContinue}
                    testID="question-continue"
                  />
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  // Header row (back button + stepper + spacer)
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s6,
    marginTop: spacing.s6,
    marginBottom: spacing.s2,
  },
  stepper: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: { height: 8, borderRadius: radius.full },
  dotActive: { width: 24, height: 8, backgroundColor: colors.primary },
  dotCompleted: { width: 8, backgroundColor: colors.primary, opacity: 0.5 },
  dotUpcoming: { width: 8, backgroundColor: colors.outlineVariant },

  // Continue button row (inside scroll content)
  continueRow: {
    marginTop: spacing.s8,
    paddingBottom: spacing.s8,
    gap: spacing.s2,
    alignItems: "stretch",
  },

  scrollContent: {
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s8,
  },

  // Question card
  questionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s8,
    marginTop: spacing.s4,
    ...shadows.card,
  },
  questionLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    letterSpacing: 0.5,
    marginBottom: spacing.s4,
  },
  questionText: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },

  // Hero mic
  micSection: {
    alignItems: "center",
    marginTop: spacing.s8,
    marginBottom: spacing.s4,
  },
  micStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    backgroundColor: colors.primaryContainer,
    opacity: 0.28,
  },
  micPulseRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(215, 231, 211, 0.45)",
  },
  micMain: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
  micMainRecording: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
  },
  micMainDisabled: { opacity: 0.45 },
  micLabel: {
    ...typography.labelMd,
    color: colors.secondary,
    textAlign: "center",
    marginTop: spacing.s4,
  },
  micLabelRecording: { color: colors.error },
  micLabelError: { color: colors.error },

  // Answer display card
  answerCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s6,
    marginBottom: spacing.s4,
    ...shadows.card,
  },
  answerText: {
    ...typography.bodyLg,
    color: colors.onSurface,
    lineHeight: 26,
    marginBottom: spacing.s4,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s4,
    borderRadius: radius.full,
  },
  editButtonPressed: { backgroundColor: colors.primaryContainer },
  editButtonLabel: {
    ...typography.labelMd,
    color: colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // Text input
  textInputContainer: {
    marginBottom: spacing.s4,
  },
  textInput: {
    minHeight: 120,
    maxHeight: 220,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s6,
    ...typography.bodyLg,
    color: colors.onSurface,
    textAlignVertical: "top",
  },

  // "Or type instead"
  typeInsteadButton: {
    alignSelf: "center",
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s6,
    borderRadius: radius.full,
    marginBottom: spacing.s4,
  },
  typeInsteadButtonPressed: { backgroundColor: `${colors.primary}14` },
  typeInsteadText: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textDecorationLine: "underline",
  },

  // Optional-transition card
  transitionCardInner: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s8,
    alignItems: "center",
    marginTop: spacing.s8,
    ...shadows.card,
  },
  transitionIcon: { marginBottom: spacing.s4 },
  transitionHeadline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: "center",
  },
  transitionBody: {
    ...typography.bodyLg,
    color: colors.secondary,
    textAlign: "center",
    marginTop: spacing.s4,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: { backgroundColor: colors.surfaceContainerHigh },
  backButtonPlaceholder: { width: 44, height: 44 },
  skipLink: { paddingVertical: spacing.s4 },
  skipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
    textAlign: "center",
  },
});
