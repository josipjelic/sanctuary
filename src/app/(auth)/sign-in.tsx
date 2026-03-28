import { Button, TextInput } from "@/components";
import { validateEmail, validatePassword } from "@/lib/auth";
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

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (message.includes("Email not confirmed")) {
    return "Please confirm your email address first.";
  }
  return "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    setSubmitError(null);
    if (eErr || pErr) return;

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);

    if (error) {
      setSubmitError(mapAuthError(error.message));
    }
    // On success, onAuthStateChange fires and (auth)/_layout redirects automatically.
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
          <Text style={styles.headline}>Welcome back.</Text>
          <Text style={styles.subheadline}>Sign in to your sanctuary.</Text>

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
              testID="sign-in-email"
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
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              testID="sign-in-password"
            />
            {passwordError && (
              <Text style={styles.fieldError}>{passwordError}</Text>
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
              label="Sign In"
              onPress={handleSignIn}
              disabled={isLoading}
              testID="sign-in-submit"
            />

            <View style={styles.linksRow}>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.signUpRow}>
              <Text style={styles.mutedText}>Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>Sign up</Text>
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
  linksRow: {
    alignItems: "center",
    marginTop: spacing.s4,
  },
  signUpRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.s2,
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
