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

const QUESTIONS = OCEAN_QUESTIONS_V1;
const REQUIRED_COUNT = QUESTIONS.filter((q) => q.required).length;

type ScreenState = "question" | "optional-transition";

export default function OnboardingQuestionsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [screenState, setScreenState] = useState<ScreenState>("question");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const charCountOpacity = useRef(new Animated.Value(0)).current;

  const question = QUESTIONS[currentIndex];
  const currentAnswer = answers[question?.id ?? 0] ?? "";
  const isRequired = question?.required ?? true;
  const isLastRequired = currentIndex === REQUIRED_COUNT - 1;
  const isOptionalQuestion = !isRequired;
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;

  const questionLabel = isOptionalQuestion
    ? "Optional"
    : `${currentIndex + 1} of ${REQUIRED_COUNT}`;

  const continueLabel =
    screenState === "optional-transition"
      ? "Share more"
      : isLastRequired
        ? "Finish"
        : isLastQuestion
          ? "Finish"
          : "Continue";

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
  }, []);

  function focusInput() {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }

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
      }).start(() => focusInput());
    });
  }

  function handleContinue() {
    if (screenState === "optional-transition") {
      animateSlide("forward", () => setCurrentIndex(REQUIRED_COUNT));
      setScreenState("question");
      return;
    }

    if (isLastRequired) {
      animateSlide("forward", () => {
        setScreenState("optional-transition");
      });
      return;
    }

    if (isLastQuestion) {
      navigateToScoring();
      return;
    }

    animateSlide("forward", () => {
      setCurrentIndex((prev) => prev + 1);
    });
  }

  function handleBack() {
    if (screenState === "optional-transition") {
      animateSlide("backward", () => setScreenState("question"));
      return;
    }

    if (currentIndex === 0) return;

    animateSlide("backward", () => {
      setCurrentIndex((prev) => prev - 1);
    });
  }

  function handleSkip() {
    navigateToScoring();
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

  function handleAnswerChange(text: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: text }));
  }

  function handleInputFocus() {
    setIsInputFocused(true);
    if (!reducedMotion) {
      Animated.timing(charCountOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      charCountOpacity.setValue(1);
    }
  }

  function handleInputBlur() {
    setIsInputFocused(false);
    if (currentAnswer.length === 0) {
      if (!reducedMotion) {
        Animated.timing(charCountOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      } else {
        charCountOpacity.setValue(0);
      }
    }
  }

  async function handleMicPress() {
    if (voiceState === "recording") {
      await stopAndTranscribe();
    } else if (voiceState === "idle" || voiceState === "error") {
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
        setAnswers((prev) => ({
          ...prev,
          [question.id]: prev[question.id]
            ? `${prev[question.id]} ${transcript}`
            : transcript,
        }));
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
          reject(new Error(`transcribe-answer HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    });
  }

  const showBackButton =
    screenState === "optional-transition" ||
    (screenState === "question" && currentIndex > 0);

  const stepperLabel =
    currentIndex < REQUIRED_COUNT
      ? `Question ${currentIndex + 1} of ${REQUIRED_COUNT}`
      : `Optional question ${currentIndex - REQUIRED_COUNT + 1} of ${QUESTIONS.length - REQUIRED_COUNT}`;

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
          {/* Stepper */}
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

          {/* Main content area */}
          <Animated.View
            style={[
              styles.mainContent,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            {screenState === "optional-transition" ? (
              <View style={styles.transitionCard}>
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
              </View>
            ) : (
              <>
                {/* Question card */}
                <View style={styles.questionCard}>
                  <Text style={styles.questionLabel}>{questionLabel}</Text>
                  <Text style={styles.questionText}>{question.text}</Text>
                  <Text style={styles.questionHint}>
                    Write as much or as little as feels right.
                  </Text>
                </View>

                {/* Answer input */}
                <TextInput
                  ref={inputRef}
                  value={currentAnswer}
                  onChangeText={handleAnswerChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Your thoughts…"
                  placeholderTextColor={colors.outlineVariant}
                  multiline
                  textAlignVertical="top"
                  returnKeyType={isLastRequired ? "done" : "next"}
                  blurOnSubmit={false}
                  editable={
                    voiceState !== "recording" && voiceState !== "transcribing"
                  }
                  style={[
                    styles.textInput,
                    (voiceState === "recording" ||
                      voiceState === "transcribing") &&
                      styles.textInputVoiceActive,
                  ]}
                  accessibilityLabel={question.text}
                  accessibilityHint="Your answer is private and will not be shared"
                  testID={`question-input-${question.id}`}
                />

                {/* Voice + char count row */}
                <View style={styles.inputFooterRow}>
                  <Animated.Text
                    style={[styles.charCount, { opacity: charCountOpacity }]}
                  >
                    {currentAnswer.length}{" "}
                    {currentAnswer.length === 1 ? "character" : "characters"}
                  </Animated.Text>

                  <View style={styles.voiceControls}>
                    {voiceState === "recording" && (
                      <Text style={styles.voiceStatusText}>Recording…</Text>
                    )}
                    {voiceState === "transcribing" && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                    {voiceState === "error" && (
                      <Text style={styles.voiceErrorText}>Tap to retry</Text>
                    )}
                    <Pressable
                      onPress={() => void handleMicPress()}
                      disabled={voiceState === "transcribing"}
                      style={({ pressed }) => [
                        styles.micButton,
                        voiceState === "recording" && styles.micButtonRecording,
                        pressed &&
                          voiceState !== "recording" &&
                          styles.micButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        voiceState === "recording"
                          ? "Stop recording and transcribe"
                          : "Speak your answer"
                      }
                      testID={`question-mic-${question.id}`}
                    >
                      <Ionicons
                        name={
                          voiceState === "recording"
                            ? "stop-circle"
                            : "mic-outline"
                        }
                        size={20}
                        color={
                          voiceState === "recording"
                            ? colors.onError
                            : colors.primary
                        }
                      />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </Animated.View>

          {/* Navigation row */}
          <View style={styles.navRow}>
            <View style={styles.navLeft}>
              {showBackButton ? (
                <Pressable
                  onPress={() => {
                    void AccessibilityInfo.isReduceMotionEnabled().then(
                      (reduced) => {
                        if (!reduced) {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                        }
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
            </View>

            <View style={styles.navRight}>
              {screenState === "optional-transition" && (
                <Pressable
                  onPress={handleSkip}
                  style={styles.skipLink}
                  accessibilityRole="button"
                  accessibilityLabel="Skip optional questions and go to your sanctuary"
                  testID="question-skip"
                >
                  <Text style={styles.skipText}>Skip to my sanctuary →</Text>
                </Pressable>
              )}
              <Button
                label={continueLabel}
                variant="primary"
                onPress={handleContinue}
                testID="question-continue"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  stepper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.s8,
    marginBottom: spacing.s4,
    paddingHorizontal: spacing.s8,
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
  },
  dotActive: {
    width: 24,
    height: 8,
    backgroundColor: colors.primary,
  },
  dotCompleted: {
    width: 8,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  dotUpcoming: {
    width: 8,
    backgroundColor: colors.outlineVariant,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: spacing.s8,
  },
  questionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s8,
    marginTop: spacing.s8,
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
    marginBottom: spacing.s6,
  },
  questionHint: {
    ...typography.labelMd,
    color: colors.secondary,
  },
  textInput: {
    minHeight: 120,
    maxHeight: 240,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s6,
    ...typography.bodyLg,
    color: colors.onSurface,
    marginTop: spacing.s6,
    textAlignVertical: "top",
  },
  inputFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.s2,
    minHeight: 32,
  },
  charCount: {
    ...typography.labelMd,
    color: colors.outlineVariant,
  },
  textInputVoiceActive: {
    opacity: 0.5,
  },
  voiceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
  },
  voiceStatusText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  voiceErrorText: {
    ...typography.labelMd,
    color: colors.error,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: {
    backgroundColor: colors.error,
  },
  micButtonPressed: {
    backgroundColor: colors.primaryContainer,
  },
  transitionCard: {
    marginTop: spacing.s8,
  },
  transitionCardInner: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.s8,
    alignItems: "center",
    ...shadows.card,
  },
  transitionIcon: {
    marginBottom: spacing.s4,
  },
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
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s12,
    paddingTop: spacing.s4,
  },
  navLeft: {
    width: 44,
  },
  navRight: {
    flex: 1,
    alignItems: "flex-end",
    gap: spacing.s2,
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
  backButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  skipLink: {
    paddingVertical: spacing.s4,
  },
  skipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
    textAlign: "center",
  },
});
