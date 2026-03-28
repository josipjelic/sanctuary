import { useAuth } from "@/hooks/useAuth";
import {
  buildThoughtPayload,
  buildVoiceThoughtPayload,
  formatDuration,
  validateCaptureText,
} from "@/lib/capture";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import { Audio } from "expo-av";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RecordingState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "processing";

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".webm",
    outputFormat: Audio.AndroidOutputFormat.WEBM,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

export default function QuickCaptureScreen() {
  const { session } = useAuth();
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  const userId = session.user.id;

  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const successOpacity = useRef(new Animated.Value(0)).current;
  const [successVisible, setSuccessVisible] = useState(false);
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

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
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setPermissionError("Microphone access is required for voice capture.");
      setRecordingState("idle");
      return;
    }
    await startRecording();
  }

  async function startRecording() {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
    recordingRef.current = recording;
    setRecordingDuration(0);
    setRecordingState("recording");
    timerRef.current = setInterval(() => {
      setRecordingDuration((d) => d + 1);
    }, 1000);
  }

  async function stopRecordingAndSubmit() {
    if (!recordingRef.current) return;
    setRecordingState("processing");

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

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

    triggerSuccessAnimation();
    setRecordingState("idle");

    // Fire-and-forget — transcribe edge function (task #007)
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
    const mimeType = Platform.OS === "ios" ? "audio/mp4" : "audio/webm";
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
  const isProcessing =
    recordingState === "processing" ||
    recordingState === "requesting-permission";
  const canCapture =
    text.trim().length > 0 && !isSubmitting && recordingState === "idle";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          style={styles.heroInput}
          editable={recordingState === "idle" && !isSubmitting}
          autoFocus
          testID="capture-input"
        />

        <View style={styles.errorContainer}>
          {(textError || submitError || permissionError) && (
            <Text style={styles.errorText}>
              {textError ?? submitError ?? permissionError}
            </Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Animated.View style={{ opacity: pulseOpacity }}>
            <TouchableOpacity
              onPress={handleMicPress}
              disabled={isProcessing || isSubmitting}
              style={[
                styles.micButton,
                isRecording && styles.micButtonRecording,
                (isProcessing || isSubmitting) && styles.micButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isRecording ? "Stop recording" : "Start voice recording"
              }
              testID="mic-button"
            >
              {isProcessing ? (
                <Text style={styles.micIcon}>…</Text>
              ) : isRecording ? (
                <Text style={styles.micDuration}>
                  {formatDuration(recordingDuration)}
                </Text>
              ) : (
                <Text style={styles.micIcon}>●</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

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
  heroInput: {
    flex: 1,
    minHeight: "60%",
    fontFamily: "Manrope_400Regular",
    fontSize: 22,
    lineHeight: 32,
    color: colors.onSurface,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.s6,
    paddingTop: spacing.s8,
    paddingBottom: spacing.s4,
    textAlignVertical: "top",
  },
  errorContainer: {
    minHeight: 20,
    paddingHorizontal: spacing.s6,
    marginBottom: spacing.s2,
  },
  errorText: {
    ...typography.labelMd,
    color: colors.error,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s6,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  micButtonRecording: {
    backgroundColor: "#c0392b",
    borderColor: "#c0392b",
  },
  micButtonDisabled: {
    opacity: 0.4,
  },
  micIcon: {
    fontSize: 18,
    color: colors.onSurfaceVariant,
  },
  micDuration: {
    ...typography.labelMd,
    color: "#ffffff",
    fontFamily: "Manrope_400Regular",
  },
  captureButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  captureLabel: {
    ...typography.bodyLg,
    color: colors.onPrimary,
  },
  captureLabelDisabled: {
    color: colors.onSurfaceVariant,
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
