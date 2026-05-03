import { useSignIn, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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
import { setBaseUrl } from "@workspace/api-client-react";

type Mode = "sign-in" | "sign-up" | "verify";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

if (BASE_URL) {
  setBaseUrl(BASE_URL);
}

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isLoaded = signInLoaded && signUpLoaded;
  const canSubmit = isLoaded && !loading && email.trim().length > 0 && password.length > 0;
  const authStateMessage = !isLoaded ? "Loading auth…" : "";

  async function handleSignIn() {
    if (!signIn) {
      setError("Authentication is still loading. Please try again in a moment.");
      return;
    }
    if (!isLoaded) {
      setError("Authentication is still loading. Please try again in a moment.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/");
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? "Sign in failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!signUp) {
      setError("Authentication is still loading. Please try again in a moment.");
      return;
    }
    if (!isLoaded) {
      setError("Authentication is still loading. Please try again in a moment.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password, firstName: firstName || undefined });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify");
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUp || !isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/");
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  }

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoArea}>
          <View style={s.logoCircle}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
          </View>
          <Text style={s.brand}>Bloomy</Text>
          <Text style={s.tagline}>
            {mode === "verify"
              ? "Check your inbox"
              : mode === "sign-up"
              ? "Create your account"
              : "Welcome back"}
          </Text>
        </View>

        <View style={s.card}>
          {mode === "verify" ? (
            <>
              <Text style={s.verifyHint}>
                Enter the 6-digit code sent to {email}
              </Text>
              {!isLoaded ? <Text style={s.helper}>Loading auth…</Text> : null}
              <TextInput
                style={s.input}
                placeholder="Verification code"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                testID="input-verification-code"
              />
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pressable
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
                onPress={handleVerify}
                disabled={loading || !isLoaded}
                testID="button-verify"
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={s.primaryBtnText}>Verify Email</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setMode("sign-up")} style={s.linkRow}>
                <Text style={s.link}>Resend code</Text>
              </Pressable>
            </>
          ) : (
            <>
              {mode === "sign-up" && (
                <TextInput
                  style={s.input}
                  placeholder="First name (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  testID="input-first-name"
                />
              )}
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                testID="input-email"
              />
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, s.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  returnKeyType="done"
                  onSubmitEditing={mode === "sign-in" ? handleSignIn : handleSignUp}
                  testID="input-password"
                />
                <Pressable
                  style={s.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  testID="button-toggle-password"
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              {!isLoaded ? <Text style={s.helper}>Loading auth…</Text> : null}
              <Pressable
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
                onPress={mode === "sign-in" ? handleSignIn : handleSignUp}
                disabled={!canSubmit}
                testID="button-submit"
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={s.primaryBtnText}>
                    {mode === "sign-in" ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={s.linkRow}
                onPress={() => {
                  setError("");
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
                testID="button-toggle-mode"
              >
                <Text style={s.linkMuted}>
                  {mode === "sign-in" ? "Don't have an account? " : "Already have an account? "}
                  <Text style={s.link}>
                    {mode === "sign-in" ? "Sign up" : "Sign in"}
                  </Text>
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: insets.top + 40,
      paddingBottom: insets.bottom + 24,
      justifyContent: "center",
    },
    logoArea: { alignItems: "center", marginBottom: 40 },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    brand: {
      fontSize: 32,
      fontFamily: "Outfit_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    tagline: {
      fontSize: 16,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    verifyHint: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 20,
    },
    input: {
      height: 52,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: "Outfit_400Regular",
      color: colors.foreground,
      backgroundColor: colors.background,
      marginBottom: 12,
    },
    passwordRow: { position: "relative" },
    passwordInput: { paddingRight: 48 },
    eyeBtn: {
      position: "absolute",
      right: 14,
      top: 15,
    },
    error: {
      fontSize: 13,
      fontFamily: "Outfit_400Regular",
      color: colors.destructive,
      marginBottom: 12,
      textAlign: "center",
    },
    helper: {
      fontSize: 13,
      fontFamily: "Outfit_500Medium",
      color: colors.mutedForeground,
      marginBottom: 12,
      textAlign: "center",
    },
    primaryBtn: {
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryBtnText: {
      fontSize: 16,
      fontFamily: "Outfit_600SemiBold",
      color: colors.primaryForeground,
    },
    pressed: { opacity: 0.8 },
    linkRow: { alignItems: "center", marginTop: 16 },
    link: {
      fontSize: 14,
      fontFamily: "Outfit_500Medium",
      color: colors.primary,
    },
    linkMuted: {
      fontSize: 14,
      fontFamily: "Outfit_400Regular",
      color: colors.mutedForeground,
    },
  });
