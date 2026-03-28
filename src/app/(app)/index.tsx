import { useAuth } from "@/hooks/useAuth";
import {
  buildThoughtPayload,
  buildVoiceThoughtPayload,
  formatDuration,
  validateCaptureText,
} from "@/lib/capture";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing, typography } from "@/lib/theme";
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
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: ".m4a",
    sampleRate: 16000,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
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
  const { session } = useAuth();
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
    } catch {
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
            <View
              style={styles.headerIconSlot}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.primary}
              />
            </View>
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
