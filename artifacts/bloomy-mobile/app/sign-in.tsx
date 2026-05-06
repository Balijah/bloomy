import { useAuth } from "@clerk/expo";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type AuthMode = "signIn" | "signUp";
type AuthStep = "email" | "password" | "code";

type ClerkFactor = {
  strategy?: string;
  emailAddressId?: string;
};

const RATE_LIMIT_COOLDOWN_SECONDS = 30;

function messageFromClerkError(error: unknown) {
  const clerkErrors = (
    error as { errors?: Array<{ longMessage?: string; message?: string }> }
  )?.errors;
  if (Array.isArray(clerkErrors) && clerkErrors.length > 0) {
    return clerkErrors
      .map((item) => item.longMessage || item.message)
      .filter(Boolean)
      .join("\n");
  }
  return error instanceof Error ? error.message : "Authentication failed.";
}

function clerkErrorCodes(error: unknown) {
  const clerkErrors = (error as { errors?: Array<{ code?: string }> })?.errors;
  if (!Array.isArray(clerkErrors)) return [];
  return clerkErrors.map((item) => item.code).filter(Boolean);
}

function isRateLimitError(error: unknown) {
  const record = error as {
    status?: number;
    statusCode?: number;
    errors?: Array<{
      code?: string;
      longMessage?: string;
      message?: string;
    }>;
  };
  if (record?.status === 429 || record?.statusCode === 429) return true;

  const clerkErrors = record?.errors;
  if (!Array.isArray(clerkErrors)) return false;

  return clerkErrors.some((item) => {
    const text = `${item.code ?? ""} ${item.longMessage ?? ""} ${
      item.message ?? ""
    }`.toLowerCase();
    return (
      text.includes("too many") ||
      text.includes("rate limit") ||
      text.includes("rate_limit")
    );
  });
}

function getSupportedFactors(resource: unknown): ClerkFactor[] {
  const factors = (resource as { supportedFirstFactors?: ClerkFactor[] })
    ?.supportedFirstFactors;
  return Array.isArray(factors) ? factors : [];
}

function getEmailCodeFactor(resource: unknown) {
  return getSupportedFactors(resource).find(
    (factor) => factor.strategy === "email_code" && factor.emailAddressId,
  );
}

function hasPasswordFactor(resource: unknown) {
  return getSupportedFactors(resource).some(
    (factor) => factor.strategy === "password",
  );
}

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isLoaded: signInLoaded,
    signIn,
    setActive,
  } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const ready = isLoaded && signInLoaded && signUpLoaded;
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const styles = createStyles(colors, insets);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setTimeout(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/" />;
  }

  function resetFlow(nextMode = mode) {
    setMode(nextMode);
    setStep("email");
    setPassword("");
    setCode("");
    setEmailAddressId(null);
    setNotice("");
    setError("");
    setCooldownSeconds(0);
  }

  function handleAuthError(err: unknown) {
    if (isRateLimitError(err)) {
      setCooldownSeconds(RATE_LIMIT_COOLDOWN_SECONDS);
      setError(
        "Clerk is rate-limiting sign-in attempts. Wait a bit before trying again.",
      );
      return;
    }
    setError(messageFromClerkError(err));
  }

  async function activateSession(sessionId?: string | null) {
    if (!sessionId) {
      setError("Sign-in did not return a usable session.");
      return false;
    }
    await setActive?.({ session: sessionId });
    return true;
  }

  async function prepareSignInEmailCode(resource: unknown) {
    const factor = getEmailCodeFactor(resource);
    if (!factor?.emailAddressId) return false;

    await (signIn as any).prepareFirstFactor({
      strategy: "email_code",
      emailAddressId: factor.emailAddressId,
    });
    setEmailAddressId(factor.emailAddressId);
    setStep("code");
    setCode("");
    setNotice(`Enter the verification code sent to ${normalizedEmail}.`);
    return true;
  }

  async function handleComplete(resource: unknown) {
    const sessionId = (resource as { createdSessionId?: string | null })
      ?.createdSessionId;
    const status = (resource as { status?: string })?.status;
    if (status === "complete" || sessionId) {
      return activateSession(sessionId);
    }
    return false;
  }

  async function handleEmailSubmit() {
    if (!normalizedEmail) {
      setError("Enter your email address.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (mode === "signIn") {
        const result = await (signIn as any).create({
          identifier: normalizedEmail,
        });

        if (await handleComplete(result)) return;
        if (await prepareSignInEmailCode(result)) return;

        if (hasPasswordFactor(result)) {
          setStep("password");
          setNotice("Enter your password to continue.");
          return;
        }

        setError("This account needs a sign-in method that is not enabled in the app yet.");
        return;
      }

      const result = await (signUp as any).create({
        emailAddress: normalizedEmail,
      });

      if (await handleComplete(result)) return;

      await (signUp as any).prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setStep("code");
      setCode("");
      setNotice(`Enter the verification code sent to ${normalizedEmail}.`);
    } catch (err) {
      const codes = clerkErrorCodes(err);
      if (
        mode === "signUp" &&
        (codes.includes("form_password_param_missing") ||
          codes.includes("form_param_missing"))
      ) {
        setStep("password");
        setError("Create a password to finish sign-up.");
        return;
      }
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit() {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (mode === "signIn") {
        const result = await (signIn as any).attemptFirstFactor({
          strategy: "password",
          password,
        });
        if (await handleComplete(result)) return;
        if (await prepareSignInEmailCode(result)) return;
        setError("Additional verification is required.");
        return;
      }

      const result = await (signUp as any).upsert({
        emailAddress: normalizedEmail,
        password,
      });
      if (await handleComplete(result)) return;

      await (signUp as any).prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setStep("code");
      setCode("");
      setNotice(`Enter the verification code sent to ${normalizedEmail}.`);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit() {
    if (code.trim().length < 4) {
      setError("Enter the verification code.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (mode === "signIn") {
        const result = await (signIn as any).attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (await handleComplete(result)) return;

        if (hasPasswordFactor(result)) {
          setStep("password");
          setNotice("Enter your password to finish signing in.");
          return;
        }
        setError("Additional verification is required.");
        return;
      }

      const result = await (signUp as any).attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (await handleComplete(result)) return;

      const missingFields = (result as { missingFields?: string[] })?.missingFields;
      if (missingFields?.includes("password")) {
        setStep("password");
        setNotice("Create a password to finish sign-up.");
        return;
      }

      setError("Additional information is required to finish sign-up.");
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    setSubmitting(true);
    setError("");

    try {
      if (mode === "signIn") {
        if (!emailAddressId) {
          setError("Start sign-in again to request a new code.");
          return;
        }
        await (signIn as any).prepareFirstFactor({
          strategy: "email_code",
          emailAddressId,
        });
      } else {
        await (signUp as any).prepareEmailAddressVerification({
          strategy: "email_code",
        });
      }
      setNotice(`A new code was sent to ${normalizedEmail}.`);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const isSubmitDisabled = submitting || cooldownSeconds > 0;
  const submitLabel =
    cooldownSeconds > 0
      ? `Try again in ${cooldownSeconds}s`
      : step === "email"
      ? mode === "signIn"
        ? "Continue"
        : "Create Account"
      : step === "password"
        ? "Continue"
        : "Verify Code";
  const submitAction =
    step === "email"
      ? handleEmailSubmit
      : step === "password"
        ? handlePasswordSubmit
        : handleCodeSubmit;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={34} color={colors.primary} />
          </View>
          <Text style={styles.brand}>Bloomy</Text>
          <Text style={styles.tagline}>
            Weather and crop risk for your fields
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="button"
            onPress={() => resetFlow("signIn")}
            style={[
              styles.segment,
              mode === "signIn" && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "signIn" && styles.segmentTextActive,
              ]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => resetFlow("signUp")}
            style={[
              styles.segment,
              mode === "signUp" && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "signUp" && styles.segmentTextActive,
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={step === "email" && !submitting}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, step !== "email" && styles.inputLocked]}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          {step === "password" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                style={styles.input}
                textContentType={mode === "signIn" ? "password" : "newPassword"}
                value={password}
              />
            </View>
          ) : null}

          {step === "code" ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                autoCapitalize="characters"
                autoComplete="one-time-code"
                keyboardType="number-pad"
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.mutedForeground}
                style={styles.input}
                textContentType="oneTimeCode"
                value={code}
              />
            </View>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitDisabled}
            onPress={submitAction}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSubmitDisabled) && styles.primaryButtonPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>{submitLabel}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={22}
                  color={colors.primaryForeground}
                />
              </>
            )}
          </Pressable>

          {step === "code" ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitDisabled}
              onPress={handleResendCode}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </Pressable>
          ) : null}

          {step !== "email" ? (
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => resetFlow(mode)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Use a different email</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingTop: insets.top + 28,
      paddingBottom: insets.bottom + 32,
      gap: 22,
    },
    brandHeader: {
      alignItems: "center",
    },
    logoCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    brand: {
      fontSize: 30,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
    },
    tagline: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    segmentedControl: {
      flexDirection: "row",
      padding: 4,
      borderRadius: 18,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingHorizontal: 10,
    },
    segmentActive: {
      backgroundColor: colors.card,
      shadowColor: colors.foreground,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    segmentText: {
      fontFamily: "Outfit_600SemiBold",
      fontSize: 15,
      color: colors.mutedForeground,
    },
    segmentTextActive: {
      color: colors.foreground,
    },
    form: {
      gap: 14,
    },
    fieldGroup: {
      gap: 8,
    },
    label: {
      fontFamily: "Outfit_700Bold",
      fontSize: 13,
      letterSpacing: 0,
      textTransform: "uppercase",
      color: colors.mutedForeground,
    },
    input: {
      minHeight: 58,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 18,
      fontFamily: "Outfit_500Medium",
      fontSize: 17,
      color: colors.foreground,
    },
    inputLocked: {
      backgroundColor: colors.muted,
      color: colors.mutedForeground,
    },
    notice: {
      fontFamily: "Outfit_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.mutedForeground,
    },
    error: {
      fontFamily: "Outfit_600SemiBold",
      fontSize: 14,
      lineHeight: 20,
      color: colors.destructive,
    },
    primaryButton: {
      minHeight: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
    },
    primaryButtonPressed: {
      opacity: 0.72,
    },
    primaryButtonText: {
      fontFamily: "Outfit_700Bold",
      fontSize: 17,
      color: colors.primaryForeground,
    },
    secondaryButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      fontFamily: "Outfit_600SemiBold",
      fontSize: 15,
      color: colors.primary,
    },
  });
