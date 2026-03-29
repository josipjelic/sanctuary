import { Button, TextInput } from "@/components";
import { validateEmail } from "@/lib/auth";
import { getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleReset() {
    const eErr = validateEmail(email);
    setEmailError(eErr);
    setSubmitError(null);
    if (eErr) return;

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    setIsLoading(false);

    if (error) {
      setSubmitError("Something went wrong. Please try again.");
      return;
    }

    setIsSuccess(true);
  }

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.headline}>Check your inbox.</Text>
          <Text style={styles.subheadline}>
            If an account exists for that email, you'll receive a password reset
            link shortly.
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.headline}>Reset your password.</Text>
          <Text style={styles.subheadline}>
            Enter your email and we'll send you a reset link.
          </Text>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (emailError) setEmailError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleReset}
            testID="forgot-password-email"
          />
          {emailError && <Text style={styles.fieldError}>{emailError}</Text>}

          {submitError && <Text style={styles.submitError}>{submitError}</Text>}

          <View style={styles.buttonGap} />

          {isLoading && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.spinner}
            />
          )}
          <Button
            label="Send Reset Link"
            onPress={handleReset}
            disabled={isLoading}
            testID="forgot-password-submit"
          />

          <View style={styles.backRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s8,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.s6,
  },
  headline: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.s2,
  },
  subheadline: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s8,
  },
  fieldError: {
    ...typography.labelMd,
    color: colors.error,
    marginTop: spacing.s2,
  },
  submitError: {
    ...typography.labelMd,
    color: colors.error,
    marginTop: spacing.s4,
    textAlign: "center",
  },
  buttonGap: { height: spacing.s4 },
  spinner: {
    marginBottom: spacing.s2,
  },
  backRow: {
    alignItems: "center",
    marginTop: spacing.s4,
  },
  link: {
    ...typography.labelMd,
    color: colors.primary,
  },
});
