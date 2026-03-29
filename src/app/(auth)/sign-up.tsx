import { Button, TextInput } from "@/components";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/auth";
import { getEmailConfirmationRedirectUrl } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";
import { colors, spacing, typography } from "@/lib/theme";
import { Link } from "expo-router";
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

function mapSignUpError(message: string): string {
  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  return "Something went wrong. Please try again.";
}

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSignUp() {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirmPassword);
    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmError(cErr);
    setSubmitError(null);
    if (eErr || pErr || cErr) return;

    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl(),
      },
    });
    setIsLoading(false);

    if (error) {
      setSubmitError(mapSignUpError(error.message));
      return;
    }

    if (!data.session) {
      // Email confirmation required (production)
      setIsSuccess(true);
    }
    // If data.session is non-null (local dev, confirmation disabled),
    // onAuthStateChange fires and (auth)/_layout redirects automatically.
  }

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.headline}>Check your inbox.</Text>
          <Text style={styles.subheadline}>
            We sent a confirmation link to{" "}
            <Text style={styles.emailHighlight}>{email}</Text>. Tap it to
            activate your account.
          </Text>
          <View style={styles.buttonGap} />
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
          <Text style={styles.headline}>Create an account.</Text>
          <Text style={styles.subheadline}>Your sanctuary awaits.</Text>

          <View style={styles.form}>
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
              returnKeyType="next"
              testID="sign-up-email"
            />
            {emailError && <Text style={styles.fieldError}>{emailError}</Text>}

            <View style={styles.fieldGap} />

            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError(null);
              }}
              secureTextEntry
              returnKeyType="next"
              testID="sign-up-password"
            />
            {passwordError && (
              <Text style={styles.fieldError}>{passwordError}</Text>
            )}

            <View style={styles.fieldGap} />

            <TextInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (confirmError) setConfirmError(null);
              }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              testID="sign-up-confirm-password"
            />
            {confirmError && (
              <Text style={styles.fieldError}>{confirmError}</Text>
            )}

            {submitError && (
              <Text style={styles.submitError}>{submitError}</Text>
            )}

            <View style={styles.buttonGap} />

            {isLoading && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.spinner}
              />
            )}
            <Button
              label="Create Account"
              onPress={handleSignUp}
              disabled={isLoading}
              testID="sign-up-submit"
            />

            <View style={styles.signInRow}>
              <Text style={styles.mutedText}>Already have an account? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>Sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>
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
  emailHighlight: {
    color: colors.onSurface,
  },
  form: {
    gap: 0,
  },
  fieldGap: { height: spacing.s2 },
  buttonGap: { height: spacing.s4 },
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
  spinner: {
    marginBottom: spacing.s2,
  },
  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.s4,
  },
  link: {
    ...typography.labelMd,
    color: colors.primary,
  },
  mutedText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
});
