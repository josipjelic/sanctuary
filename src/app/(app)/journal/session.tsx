import { Button, Card } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { colors, radius, shadows, spacing, typography } from "@/lib/theme";
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
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
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

type SessionState =
  | "loading_question"
  | "answering"
  | "saving"
  | "error_question"
  | "error_save";

type VoiceState = "idle" | "recording" | "transcribing" | "error";

type Turn = {
  turn_index: number;
  question: string;
  answer: string;
};

export default function JournalSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { width: screenWidth } = useWindowDimensions();

  const [sessionState, setSessionState] =
    useState<SessionState>("loading_question");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showExitSheet, setShowExitSheet] = useState(false);
  const [saveErrorVisible, setSaveErrorVisible] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [showTextInput, setShowTextInput] = useState(false);

  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const skeletonOpacity1 = useRef(new Animated.Value(0.6)).current;
  const skeletonOpacity2 = useRef(new Animated.Value(0.6)).current;
  const skeletonAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const saveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const ringAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const micSize = Math.min(148, Math.round(screenWidth * 0.38));
  const micIconSize = Math.round(micSize * 0.3);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      reducedMotion.current = val;
    });
  }, []);

  // ── Pulse ring (idle) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion.current) return;
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
  }, [ringScale]);

  // ── Pulse opacity (recording) ──────────────────────────────────────────────
  useEffect(() => {
    if (voiceState === "recording" && !reducedMotion.current) {
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
  }, [voiceState, pulseOpacity]);

  const animateCardIn = useCallback(() => {
    if (reducedMotion.current) {
      slideAnim.setValue(0);
      return;
    }
    slideAnim.setValue(screenWidth);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, screenWidth]);

  const startSkeletonShimmer = useCallback(() => {
    if (reducedMotion.current) {
      skeletonOpacity1.setValue(0.6);
      skeletonOpacity2.setValue(0.6);
      return;
    }
    skeletonAnimation.current?.stop();
    skeletonAnimation.current = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(skeletonOpacity1, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonOpacity1, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(skeletonOpacity2, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonOpacity2, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    skeletonAnimation.current.start();
  }, [skeletonOpacity1, skeletonOpacity2]);

  const stopSkeletonShimmer = useCallback(() => {
    skeletonAnimation.current?.stop();
  }, []);

  const displayQuestion = useCallback(
    (question: string, turnIndex: number) => {
      setCurrentQuestion(question);
      setCurrentTurnIndex(turnIndex);
      setAnswer("");
      setShowTextInput(false);
      setVoiceState("idle");
      setSessionState("answering");
      stopSkeletonShimmer();
      animateCardIn();
    },
    [animateCardIn, stopSkeletonShimmer],
  );

  const upsertEntry = useCallback(
    async (turnIndex: number, question: string, answerText: string | null) => {
      const { error } = await supabase.from("journal_entries").upsert(
        {
          session_id: sessionId,
          user_id: userId,
          turn_index: turnIndex,
          question,
          answer: answerText,
          ...(answerText !== null
            ? { answered_at: new Date().toISOString() }
            : {}),
        },
        { onConflict: "session_id,turn_index" },
      );
      if (error) {
        logger.error("JournalSession: failed to upsert entry", error);
      }
    },
    [sessionId, userId],
  );

  const fetchNextQuestion = useCallback(
    async (completedTurns: Turn[]) => {
      setSessionState("loading_question");
      startSkeletonShimmer();

      try {
        const { data, error } = await supabase.functions.invoke(
          "journal-next-question",
          {
            body: {
              session_id: sessionId,
              turns: completedTurns.map((t) => ({
                turn_index: t.turn_index,
                question: t.question,
                answer: t.answer,
              })),
            },
          },
        );

        if (error) throw error;

        const result = data as
          | { question: string; turn_index: number }
          | { done: true };

        if ("done" in result && result.done) {
          await saveSession();
          return;
        }

        if ("question" in result) {
          await upsertEntry(result.turn_index, result.question, null);
          displayQuestion(result.question, result.turn_index);
        }
      } catch (err) {
        logger.error("JournalSession: fetchNextQuestion failed", err);
        stopSkeletonShimmer();
        setSessionState("error_question");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sessionId,
      startSkeletonShimmer,
      stopSkeletonShimmer,
      displayQuestion,
      upsertEntry,
    ],
  );

  const saveSession = useCallback(async () => {
    setSessionState("saving");
    try {
      const { error } = await supabase.functions.invoke(
        "journal-save-session",
        {
          body: { session_id: sessionId },
        },
      );
      if (error) throw error;
      router.replace("/(app)/journal/complete");
    } catch (err) {
      logger.error("JournalSession: saveSession failed", err);
      setSessionState("answering");
      setSaveErrorVisible(true);
      saveErrorTimer.current = setTimeout(() => {
        setSaveErrorVisible(false);
      }, 4000);
    }
  }, [sessionId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs on mount only; fetchNextQuestion and displayQuestion are stable useCallbacks
  useEffect(() => {
    if (!sessionId) return;

    void (async () => {
      const { data: existingEntries } = await supabase
        .from("journal_entries")
        .select("turn_index, question, answer, answered_at")
        .eq("session_id", sessionId)
        .order("turn_index", { ascending: true });

      const entries = (existingEntries ?? []) as {
        turn_index: number;
        question: string;
        answer: string | null;
        answered_at: string | null;
      }[];

      // Build answered turns
      const answeredTurns: Turn[] = entries
        .filter((e) => e.answer !== null && e.answer !== undefined)
        .map((e) => ({
          turn_index: e.turn_index,
          question: e.question,
          answer: e.answer ?? "",
        }));

      setTurns(answeredTurns);

      // Find the first unanswered entry
      const unanswered = entries.find(
        (e) => e.answer === null || e.answer === undefined,
      );

      if (unanswered) {
        // Resume: show the unanswered question
        displayQuestion(unanswered.question, unanswered.turn_index);
      } else if (entries.length === 0) {
        // Brand new session: fetch opening question
        await fetchNextQuestion([]);
      } else {
        // All answered — fetch next
        await fetchNextQuestion(answeredTurns);
      }
    })();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (saveErrorTimer.current) {
        clearTimeout(saveErrorTimer.current);
      }
      skeletonAnimation.current?.stop();
      pulseAnimation.current?.stop();
      ringAnimation.current?.stop();
    };
  }, []);

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function handleMicPress() {
    if (voiceState === "recording") {
      await stopAndTranscribe();
    } else if (voiceState !== "transcribing") {
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
      logger.error("JournalSession: failed to start voice recording", err);
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
        setAnswer(transcript);
      }
      setVoiceState("idle");
    } catch (err) {
      logger.error("JournalSession: transcribe-answer failed", err);
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

  async function handleNext() {
    const trimmed = answer.trim();
    const finalAnswer = trimmed;

    // Update entry with answer
    await upsertEntry(currentTurnIndex, currentQuestion, finalAnswer);

    const newTurns: Turn[] = [
      ...turns,
      {
        turn_index: currentTurnIndex,
        question: currentQuestion,
        answer: finalAnswer,
      },
    ];
    setTurns(newTurns);

    const isLastTurn = currentTurnIndex >= 2;
    if (isLastTurn) {
      await saveSession();
    } else {
      await fetchNextQuestion(newTurns);
    }
  }

  async function handleSkip() {
    await upsertEntry(currentTurnIndex, currentQuestion, "");

    const newTurns: Turn[] = [
      ...turns,
      { turn_index: currentTurnIndex, question: currentQuestion, answer: "" },
    ];
    setTurns(newTurns);

    const isLastTurn = currentTurnIndex >= 2;
    if (isLastTurn) {
      await saveSession();
    } else {
      await fetchNextQuestion(newTurns);
    }
  }

  function handleBackPress() {
    setShowExitSheet(true);
  }

  const isLoading = sessionState === "loading_question";
  const isSaving = sessionState === "saving";
  const isErrorQuestion = sessionState === "error_question";
  const isLastTurn = currentTurnIndex >= 2;
  const isRecording = voiceState === "recording";
  const isTranscribing = voiceState === "transcribing";
  const isDisabled = isTranscribing;
  const canSubmit = answer.trim().length >= 10;
  const displayTurnIndex = isLoading ? turns.length + 1 : currentTurnIndex + 1;

  const micLabel = isRecording
    ? "Tap to finish"
    : isTranscribing
      ? "Transcribing…"
      : voiceState === "error"
        ? "Something went wrong — tap to try again"
        : answer
          ? "Tap to re-record"
          : "Tap to speak";

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Back — leave journal session"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Journal
          </Text>
          <Text
            style={styles.progress}
            accessibilityLabel={`Question ${displayTurnIndex} of 3`}
          >
            {displayTurnIndex} / 3
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Question card */}
            <Animated.View
              style={{ transform: [{ translateX: isLoading ? 0 : slideAnim }] }}
            >
              <Card
                variant="elevated"
                size="lg"
                style={styles.questionCard}
                testID="journal-question-card"
              >
                {isLoading ? (
                  <View
                    accessibilityLabel="Loading next question"
                    accessibilityLiveRegion="polite"
                  >
                    <Animated.View
                      style={[
                        styles.skeletonBar,
                        styles.skeletonBar1,
                        { opacity: skeletonOpacity1 },
                      ]}
                      accessibilityElementsHidden
                    />
                    <Animated.View
                      style={[
                        styles.skeletonBar,
                        styles.skeletonBar2,
                        { opacity: skeletonOpacity2 },
                      ]}
                      accessibilityElementsHidden
                    />
                  </View>
                ) : (
                  <View
                    accessibilityLabel={`Question ${currentTurnIndex + 1} of 3: ${currentQuestion}`}
                  >
                    <Text style={styles.turnLabel}>
                      Question {currentTurnIndex + 1}
                    </Text>
                    <Text style={styles.questionText}>{currentQuestion}</Text>
                    {currentTurnIndex === 0 && (
                      <Text style={styles.questionHint}>
                        Take your time. Write as much or as little as feels
                        right.
                      </Text>
                    )}
                  </View>
                )}
              </Card>
            </Animated.View>

            {/* Error — failed to load question */}
            {isErrorQuestion && (
              <View
                style={styles.questionErrorContainer}
                accessibilityRole="alert"
              >
                <Text style={styles.questionErrorText}>
                  Couldn't load the next question.
                </Text>
                <Pressable
                  onPress={() => void fetchNextQuestion(turns)}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  style={styles.retryPressable}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            )}

            {/* Voice-first input area */}
            {!isLoading && !isErrorQuestion && (
              <>
                {/* Hero mic button */}
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
                        testID="journal-mic-btn"
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

                {/* Transcribed/typed answer display */}
                {answer !== "" && !showTextInput && (
                  <View style={styles.answerCard}>
                    <Text style={styles.answerText} numberOfLines={6}>
                      {answer}
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
                      testID="journal-edit-btn"
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

                {/* Text input (secondary, shown on demand) */}
                {showTextInput && (
                  <View style={styles.textInputContainer}>
                    <TextInput
                      ref={inputRef}
                      value={answer}
                      onChangeText={setAnswer}
                      multiline
                      style={[
                        styles.answerInput,
                        isSaving && styles.answerInputDisabled,
                      ]}
                      placeholder="Your thoughts…"
                      placeholderTextColor={colors.outlineVariant}
                      editable={!isSaving}
                      accessibilityLabel={currentQuestion}
                      accessibilityHint="Your answer is private"
                      returnKeyType="default"
                      blurOnSubmit={false}
                      textAlignVertical="top"
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      testID="journal-answer-input"
                    />
                    {(isFocused || answer.length > 0) && (
                      <Text
                        style={styles.charCount}
                        accessibilityElementsHidden
                      >
                        {answer.length} characters
                      </Text>
                    )}
                  </View>
                )}

                {/* "Or type instead" link */}
                {answer === "" && voiceState === "idle" && !showTextInput && (
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
                    testID="journal-type-instead-btn"
                  >
                    <Text style={styles.typeInsteadText}>Or type instead</Text>
                  </Pressable>
                )}

                {/* Continue / Save button row */}
                <View style={styles.continueRow}>
                  {isLastTurn ? (
                    <Pressable
                      style={[
                        styles.primaryButton,
                        isSaving && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void handleNext()}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isSaving
                          ? "Saving your journal"
                          : "Save journal session"
                      }
                      accessibilityState={{ disabled: isSaving }}
                      testID="journal-save-btn"
                    >
                      {isSaving ? (
                        <View style={styles.savingRow}>
                          <ActivityIndicator
                            color={colors.onPrimary}
                            size="small"
                            style={styles.savingIndicator}
                          />
                          <Text style={styles.primaryButtonLabel}>Saving…</Text>
                        </View>
                      ) : (
                        <Text style={styles.primaryButtonLabel}>
                          Save journal
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.primaryButton,
                        (!canSubmit || isSaving) &&
                          styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void handleNext()}
                      disabled={!canSubmit || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Next question"
                      accessibilityState={{ disabled: !canSubmit || isSaving }}
                      testID="journal-next-btn"
                    >
                      {isSaving ? (
                        <ActivityIndicator
                          color={colors.onPrimary}
                          size="small"
                        />
                      ) : (
                        <Text style={styles.primaryButtonLabel}>Next</Text>
                      )}
                    </Pressable>
                  )}

                  {currentTurnIndex > 0 && !isSaving && (
                    <Pressable
                      style={styles.skipPressable}
                      onPress={() => void handleSkip()}
                      accessibilityRole="button"
                      accessibilityLabel="Skip this question"
                      testID="journal-skip-btn"
                    >
                      <Text style={styles.skipText}>Skip this question</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Save error toast */}
        {saveErrorVisible && (
          <View style={styles.saveErrorToast} accessibilityRole="alert">
            <Text style={styles.saveErrorText}>
              Couldn't save your journal. Try again.
            </Text>
          </View>
        )}

        {/* Exit confirmation sheet */}
        <Modal
          visible={showExitSheet}
          animationType="slide"
          transparent
          onRequestClose={() => setShowExitSheet(false)}
          accessibilityViewIsModal
        >
          <Pressable
            style={styles.exitModalBackdrop}
            onPress={() => setShowExitSheet(false)}
            accessibilityLabel="Dismiss"
          >
            <Pressable
              style={styles.exitSheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.exitHeadline}>Leave your journal?</Text>
              <Text style={styles.exitBody}>
                Your answers so far are saved. You can continue later.
              </Text>
              <Button
                label="Keep writing"
                variant="primary"
                onPress={() => setShowExitSheet(false)}
                testID="journal-keep-writing-btn"
              />
              <Button
                label="Leave for now"
                variant="secondary"
                onPress={() => {
                  setShowExitSheet(false);
                  router.back();
                }}
                style={styles.leaveButton}
                testID="journal-leave-btn"
              />
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: `${colors.primary}14`,
  },
  headerTitle: {
    ...typography.labelMd,
    color: colors.onSurface,
    letterSpacing: 0.5,
  },
  progress: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    textAlign: "right",
    minWidth: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s4,
    flexGrow: 1,
  },
  questionCard: {
    padding: spacing.s8,
    marginTop: spacing.s6,
  },
  skeletonBar: {
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary}20`,
    height: 20,
    marginBottom: spacing.s2,
  },
  skeletonBar1: {
    width: "85%",
  },
  skeletonBar2: {
    width: "60%",
  },
  turnLabel: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    letterSpacing: 0.5,
    marginBottom: spacing.s4,
  },
  questionText: {
    ...typography.headlineMd,
    color: colors.onSurface,
    lineHeight: 36,
    marginBottom: spacing.s4,
  },
  questionHint: {
    ...typography.labelMd,
    color: colors.secondary,
    marginTop: spacing.s2,
  },
  questionErrorContainer: {
    marginTop: spacing.s4,
  },
  questionErrorText: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
  },
  retryPressable: {
    paddingVertical: spacing.s4,
    marginTop: spacing.s2,
  },
  retryText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
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

  // Text input (secondary)
  textInputContainer: {
    marginBottom: spacing.s4,
  },
  answerInput: {
    minHeight: 120,
    maxHeight: 240,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s6,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    lineHeight: 26,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  answerInputDisabled: {
    opacity: 0.6,
  },
  charCount: {
    ...typography.labelMd,
    color: colors.outlineVariant,
    alignSelf: "flex-end",
    marginTop: spacing.s2,
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

  continueRow: {
    marginTop: spacing.s8,
    paddingBottom: spacing.s8,
    gap: spacing.s2,
    alignItems: "stretch",
  },
  primaryButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 26,
    color: colors.onPrimary,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  savingIndicator: {
    marginRight: spacing.s2,
  },
  skipPressable: {
    paddingVertical: spacing.s4,
    marginTop: spacing.s4,
    alignItems: "center",
  },
  skipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
    textAlign: "center",
  },
  saveErrorToast: {
    position: "absolute",
    bottom: spacing.s20,
    left: spacing.s8,
    right: spacing.s8,
    backgroundColor: colors.error,
    borderRadius: radius.xl,
    padding: spacing.s4,
  },
  saveErrorText: {
    ...typography.bodyLg,
    color: colors.onError,
  },
  exitModalBackdrop: {
    flex: 1,
    backgroundColor: `${colors.onSurface}66`,
    justifyContent: "flex-end",
  },
  exitSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
  },
  exitHeadline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s4,
  },
  exitBody: {
    ...typography.bodyLg,
    color: colors.secondary,
    marginBottom: spacing.s8,
    lineHeight: 26,
  },
  leaveButton: {
    marginTop: spacing.s4,
  },
});
