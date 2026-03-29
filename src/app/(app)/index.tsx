import { Button } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import {
  buildThoughtPayload,
  buildVoiceThoughtPayload,
  formatDuration,
  validateCaptureText,
} from "@/lib/capture";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
import {
  TRANSCRIPTION_LANGUAGE_OPTIONS,
  type TranscriptionLanguageCode,
  getTranscriptionLanguage,
  labelForTranscriptionCode,
  setTranscriptionLanguage,
} from "@/lib/transcriptionLanguage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import type { RecordingOptions } from "expo-audio";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RecordingState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "processing";

/** Voice-optimized options (16 kHz mono) for transcription; matches prior expo-av setup. */
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 16000,
  },
  // AAC/m4a only: omit linear PCM fields from HIGH_QUALITY.ios — mixing them into MPEG4AAC
  // settings can make AVAudioRecorder.prepareToRecord() fail on iOS.
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

function startOfLocalDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function QuickCaptureScreen() {
  const { session, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const audioRecorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 250);

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  const userId = session.user.id;

  const micSize = Math.min(256, Math.round(width * 0.58));
  const heroTitleSize = Math.min(48, Math.round(width * 0.11));

  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");

  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [transcriptionLanguageCode, setTranscriptionLanguageCode] =
    useState<TranscriptionLanguageCode>("auto");
  const [signingOut, setSigningOut] = useState(false);

  const successOpacity = useRef(new Animated.Value(0)).current;
  const [successVisible, setSuccessVisible] = useState(false);
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const loadTodayCount = useCallback(async () => {
    const start = startOfLocalDay().toISOString();
    const { count, error } = await supabase
      .from("thoughts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", start);
    if (error) {
      setTodayCount(0);
      return;
    }
    setTodayCount(count ?? 0);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadTodayCount();
    }, [loadTodayCount]),
  );

  useEffect(() => {
    void getTranscriptionLanguage().then(setTranscriptionLanguageCode);
  }, []);

  useEffect(() => {
    const recorder = audioRecorder;
    return () => {
      void (async () => {
        try {
          if (recorder.getStatus().isRecording) {
            await recorder.stop();
          }
        } catch {
          /* recorder may already be stopped */
        }
      })();
    };
  }, [audioRecorder]);

  useEffect(() => {
    if (recordingState === "recording") {
      pulseAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.4,
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
  }, [recordingState, pulseOpacity]);

  useEffect(() => {
    ringAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.05,
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

  function triggerSuccessAnimation() {
    setSuccessVisible(true);
    Animated.sequence([
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setSuccessVisible(false));
  }

  async function handleTextCapture() {
    const err = validateCaptureText(text);
    if (err) {
      setTextError(err);
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("thoughts")
        .insert(buildThoughtPayload(userId, text))
        .select("id")
        .single();
      if (error || !inserted) {
        setSubmitError("Failed to save. Please try again.");
        return;
      }
      supabase.functions
        .invoke("assign-topics", {
          body: { thought_id: inserted.id, text: text.trim() },
        })
        .catch(() => {});
      setText("");
      void loadTodayCount();
      triggerSuccessAnimation();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMicPress() {
    if (recordingState === "recording") {
      await stopRecordingAndSubmit();
    } else if (recordingState === "idle") {
      await requestPermissionAndRecord();
    }
  }

  async function requestPermissionAndRecord() {
    setPermissionError(null);
    setRecordingState("requesting-permission");
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      setPermissionError("Microphone access is required for voice capture.");
      setRecordingState("idle");
      return;
    }
    await startRecording();
  }

  async function startRecording() {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingState("recording");
    } catch (error) {
      logger.error("Quick capture: failed to start recording", error);
      setPermissionError("Could not start recording. Please try again.");
      setRecordingState("idle");
    }
  }

  async function stopRecordingAndSubmit() {
    if (recordingState !== "recording") return;
    setRecordingState("processing");

    try {
      await audioRecorder.stop();
    } catch {
      setSubmitError("Recording failed. Please try again.");
      setRecordingState("idle");
      return;
    }

    const uri = audioRecorder.uri;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        interruptionMode: "mixWithOthers",
      });
    } catch {
      /* non-fatal */
    }

    if (!uri) {
      setRecordingState("idle");
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("thoughts")
      .insert(buildVoiceThoughtPayload(userId))
      .select("id")
      .single();

    if (insertError || !inserted) {
      setSubmitError("Failed to save. Please try again.");
      setRecordingState("idle");
      return;
    }

    void loadTodayCount();
    triggerSuccessAnimation();
    setRecordingState("idle");

    sendAudioForTranscription(uri, inserted.id).catch(() => {
      supabase
        .from("thoughts")
        .update({ transcription_status: "failed" })
        .eq("id", inserted.id)
        .then(() => {});
    });
  }

  async function sendAudioForTranscription(
    uri: string,
    thoughtId: string,
  ): Promise<void> {
    const filename = uri.split("/").pop()?.split("?")[0] ?? "recording.m4a";
    const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
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
    formData.append("thought_id", thoughtId);
    formData.append("transcription_language", transcriptionLanguageCode);
    const { error } = await supabase.functions.invoke("transcribe", {
      body: formData,
    });
    if (error) throw error;
  }

  const isRecording = recordingState === "recording";
  const recordingDurationSec = Math.floor(recorderState.durationMillis / 1000);
  const isProcessing =
    recordingState === "processing" ||
    recordingState === "requesting-permission";
  const canCapture =
    text.trim().length > 0 && !isSubmitting && recordingState === "idle";

  const todaySubtitle =
    todayCount === null
      ? "…"
      : todayCount === 0
        ? "No captures today"
        : `${todayCount} ${todayCount === 1 ? "capture" : "captures"} today`;

  const micIconSize = Math.round(micSize * 0.28);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setSettingsVisible(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={styles.avatarWrap}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <MaterialCommunityIcons
                  name="spa-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.brandMark}>Sanctuary</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.headerIconSlot,
                pressed && styles.headerIconSlotPressed,
              ]}
              onPress={() => setSettingsVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              testID="settings-button"
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.primary}
              />
            </Pressable>
          </View>

          <View style={styles.heroBlock}>
            <Text
              style={[
                styles.heroTitle,
                { fontSize: heroTitleSize, lineHeight: heroTitleSize + 6 },
              ]}
            >
              Speak your mind.
            </Text>
            <Text style={styles.heroSubtitle}>
              Your thoughts are safe here.
            </Text>
          </View>

          <View style={styles.micSection}>
            <View
              style={[
                styles.micStack,
                { width: micSize + 72, height: micSize + 72 },
              ]}
            >
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
              />
              <Animated.View style={{ opacity: pulseOpacity }}>
                <TouchableOpacity
                  onPress={handleMicPress}
                  disabled={isProcessing || isSubmitting}
                  style={[
                    styles.micMain,
                    {
                      width: micSize,
                      height: micSize,
                      borderRadius: micSize / 2,
                    },
                    isRecording && styles.micMainRecording,
                    (isProcessing || isSubmitting) && styles.micMainDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isRecording ? "Stop recording" : "Start voice recording"
                  }
                  testID="mic-button"
                  activeOpacity={0.92}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : isRecording ? (
                    <Text style={styles.micDuration}>
                      {formatDuration(recordingDurationSec)}
                    </Text>
                  ) : (
                    <Ionicons
                      name="mic"
                      size={micIconSize}
                      color={colors.onPrimary}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <View style={styles.typeSection}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                if (textError) setTextError(null);
                if (submitError) setSubmitError(null);
              }}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.outlineVariant}
              multiline
              textAlignVertical="top"
              style={styles.typeInput}
              editable={recordingState === "idle" && !isSubmitting}
              testID="capture-input"
            />
            <TouchableOpacity
              onPress={handleTextCapture}
              disabled={!canCapture}
              style={[
                styles.captureButton,
                !canCapture && styles.captureButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Capture thought"
              testID="capture-submit"
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.captureLabel,
                  !canCapture && styles.captureLabelDisabled,
                ]}
              >
                {isSubmitting ? "Saving…" : "Capture"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.errorContainer}>
            {(textError || submitError || permissionError) && (
              <Text style={styles.errorText}>
                {textError ?? submitError ?? permissionError}
              </Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.recentCard,
              pressed && styles.recentCardPressed,
            ]}
            onPress={() => router.push("/(app)/inbox")}
            accessibilityRole="button"
            accessibilityLabel="Recent thoughts, open inbox"
          >
            <View style={styles.recentLeft}>
              <View style={styles.recentIconCircle}>
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.recentTitle}>Recent Thoughts</Text>
                <Text style={styles.recentSubtitle}>{todaySubtitle}</Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.secondary}
              style={styles.recentChevron}
            />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {successVisible && (
        <Animated.View
          style={[styles.successToast, { opacity: successOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.successText}>Captured.</Text>
        </Animated.View>
      )}

      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <Pressable
          style={styles.settingsModalBackdrop}
          onPress={() => setSettingsVisible(false)}
          accessibilityLabel="Close settings"
        >
          <Pressable
            style={styles.settingsModalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.settingsModalTitle}>Settings</Text>
            <Pressable
              style={({ pressed }) => [
                styles.settingsLanguageRow,
                pressed && styles.settingsLanguageRowPressed,
              ]}
              onPress={() => setLanguagePickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Transcription language"
              testID="settings-transcription-language"
            >
              <View style={styles.settingsLanguageTextBlock}>
                <Text style={styles.settingsLanguageLabel}>
                  Voice transcription language
                </Text>
                <Text style={styles.settingsLanguageHint}>
                  For AI transcription only. Does not change the app interface.
                </Text>
              </View>
              <View style={styles.settingsLanguageValueRow}>
                <Text style={styles.settingsLanguageValue} numberOfLines={1}>
                  {labelForTranscriptionCode(transcriptionLanguageCode)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.secondary}
                />
              </View>
            </Pressable>
            <Text style={styles.settingsModalHint}>
              Sign out on this device. Your captures stay in your account until
              you delete them.
            </Text>
            <View style={styles.settingsModalActions}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setSettingsVisible(false)}
                disabled={signingOut}
                testID="settings-cancel"
              />
              <TouchableOpacity
                onPress={() => void handleSignOut()}
                disabled={signingOut}
                style={[
                  styles.signOutButton,
                  signingOut && styles.signOutButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                accessibilityState={{ disabled: signingOut }}
                testID="settings-sign-out"
                activeOpacity={0.9}
              >
                {signingOut ? (
                  <ActivityIndicator color={colors.onError} />
                ) : (
                  <Text style={styles.signOutLabel}>Sign out</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={languagePickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <Pressable
          style={styles.settingsModalBackdrop}
          onPress={() => setLanguagePickerVisible(false)}
          accessibilityLabel="Close language list"
        >
          <Pressable
            style={styles.languagePickerSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.languagePickerTitle}>
              Transcription language
            </Text>
            <ScrollView
              style={styles.languagePickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {TRANSCRIPTION_LANGUAGE_OPTIONS.map((opt) => {
                const selected = opt.code === transcriptionLanguageCode;
                return (
                  <Pressable
                    key={opt.code}
                    style={({ pressed }) => [
                      styles.languageOptionRow,
                      pressed && styles.languageOptionRowPressed,
                      selected && styles.languageOptionRowSelected,
                    ]}
                    onPress={() => {
                      setTranscriptionLanguageCode(opt.code);
                      void setTranscriptionLanguage(opt.code);
                      setLanguagePickerVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                    testID={`transcription-lang-${opt.code}`}
                  >
                    <Text
                      style={[
                        styles.languageOptionLabel,
                        selected && styles.languageOptionLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={22}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button
              label="Done"
              variant="secondary"
              onPress={() => setLanguagePickerVisible(false)}
              testID="transcription-lang-done"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.s8,
    paddingBottom: spacing.s24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.s4,
    paddingBottom: spacing.s6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconSlot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconSlotPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  settingsModalBackdrop: {
    flex: 1,
    backgroundColor: `${colors.onSurface}66`,
    justifyContent: "flex-end",
  },
  settingsModalSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
    gap: spacing.s4,
  },
  settingsModalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  settingsLanguageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s4,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s2,
    marginHorizontal: -spacing.s2,
    borderRadius: radius.md,
  },
  settingsLanguageRowPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  settingsLanguageTextBlock: {
    flex: 1,
    gap: 4,
  },
  settingsLanguageLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onSurface,
  },
  settingsLanguageHint: {
    ...typography.labelMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondary,
  },
  settingsLanguageValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "42%",
  },
  settingsLanguageValue: {
    ...typography.bodyLg,
    color: colors.secondary,
    flexShrink: 1,
    textAlign: "right",
  },
  languagePickerSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.s8,
    paddingBottom: spacing.s12,
    maxHeight: "78%",
  },
  languagePickerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s4,
  },
  languagePickerList: {
    flexGrow: 0,
    marginBottom: spacing.s4,
  },
  languageOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s4,
    borderRadius: radius.md,
  },
  languageOptionRowPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  languageOptionRowSelected: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  languageOptionLabel: {
    ...typography.bodyLg,
    color: colors.onSurface,
    flex: 1,
  },
  languageOptionLabelSelected: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  settingsModalHint: {
    ...typography.bodyLg,
    color: colors.secondary,
    marginBottom: spacing.s2,
  },
  settingsModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.s4,
    marginTop: spacing.s6,
  },
  signOutButton: {
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s8,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonDisabled: {
    opacity: 0.4,
  },
  signOutLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onError,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLow,
  },
  brandMark: {
    fontFamily: "Manrope_700Bold",
    fontSize: 24,
    color: colors.primary,
    letterSpacing: -0.6,
  },
  heroBlock: {
    alignItems: "center",
    marginBottom: spacing.s16,
  },
  heroTitle: {
    fontFamily: "Manrope_700Bold",
    letterSpacing: -1.2,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: spacing.s4,
  },
  heroSubtitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 18,
    lineHeight: 26,
    color: colors.secondary,
    opacity: 0.6,
    textAlign: "center",
  },
  micSection: {
    alignItems: "center",
    marginBottom: spacing.s16,
  },
  micStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    backgroundColor: colors.primaryContainer,
    opacity: 0.22,
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
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.15,
    shadowRadius: 48,
    elevation: 14,
  },
  micMainRecording: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
  },
  micMainDisabled: {
    opacity: 0.45,
  },
  micDuration: {
    ...typography.labelMd,
    color: colors.onError,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
  },
  typeSection: {
    gap: spacing.s4,
    marginBottom: spacing.s4,
  },
  typeInput: {
    minHeight: 100,
    maxHeight: 160,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    lineHeight: 26,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s4,
  },
  captureButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  captureLabel: {
    ...typography.bodyLg,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.onPrimary,
  },
  captureLabelDisabled: {
    color: colors.onSurfaceVariant,
  },
  errorContainer: {
    minHeight: 20,
    marginBottom: spacing.s4,
  },
  errorText: {
    ...typography.labelMd,
    color: colors.error,
    textAlign: "center",
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s8,
  },
  recentCardPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  recentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s4,
    flex: 1,
  },
  recentIconCircle: {
    padding: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  recentTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.onSurface,
  },
  recentSubtitle: {
    ...typography.labelMd,
    color: colors.secondary,
    marginTop: 2,
  },
  recentChevron: {
    opacity: 0.45,
  },
  successToast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s2,
    borderRadius: 99,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  successText: {
    ...typography.labelMd,
    color: colors.primary,
  },
});
