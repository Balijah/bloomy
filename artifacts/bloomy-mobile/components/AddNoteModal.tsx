/**
 * AddNoteModal — bottom-sheet style modal for composing / editing a field note.
 *
 * Supports category selection, optional severity, free-text title + body, and
 * attaching up to 3 photos via the device camera or gallery.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FieldNote } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NoteCategory =
  | "pest"
  | "disease"
  | "soil"
  | "weather"
  | "irrigation"
  | "general";

export type NoteSeverity = "low" | "medium" | "high" | "critical" | null;

export interface NoteFormData {
  date: string;
  category: NoteCategory;
  severity: NoteSeverity;
  title: string;
  body: string;
  photoData: string[];
}

interface Props {
  visible: boolean;
  editNote?: FieldNote | null;
  onClose: () => void;
  onSubmit: (data: NoteFormData) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: {
  value: NoteCategory;
  label: string;
  icon: string;
  color: string;
}[] = [
  { value: "pest", label: "Pest", icon: "bug-outline", color: "#B94040" },
  {
    value: "disease",
    label: "Disease",
    icon: "medical-outline",
    color: "#A0509A",
  },
  {
    value: "soil",
    label: "Soil",
    icon: "layers-outline",
    color: "#8B5E3C",
  },
  {
    value: "weather",
    label: "Weather",
    icon: "partly-sunny-outline",
    color: "#2860A8",
  },
  {
    value: "irrigation",
    label: "Irrigation",
    icon: "water-outline",
    color: "#0E7490",
  },
  {
    value: "general",
    label: "General",
    icon: "clipboard-outline",
    color: "#5A6A72",
  },
];

const SEVERITIES: { value: NoteSeverity; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#1A7340" },
  { value: "medium", label: "Medium", color: "#B97B14" },
  { value: "high", label: "High", color: "#C25214" },
  { value: "critical", label: "Critical", color: "#9B1C1C" },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Photo strip ───────────────────────────────────────────────────────────────

function PhotoStrip({
  photos,
  onAdd,
  onRemove,
}: {
  photos: string[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
      {photos.map((uri, i) => (
        <View key={i} style={{ position: "relative" }}>
          <Image
            source={{ uri }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              backgroundColor: colors.muted,
            }}
          />
          <Pressable
            onPress={() => onRemove(i)}
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: "#9B1C1C",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={13} color="#fff" />
          </Pressable>
        </View>
      ))}
      {photos.length < 3 && (
        <Pressable
          onPress={onAdd}
          style={{
            width: 80,
            height: 80,
            borderRadius: 10,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.muted,
            gap: 4,
          }}
        >
          <Ionicons name="camera-outline" size={22} color={colors.mutedForeground} />
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Outfit_400Regular",
              color: colors.mutedForeground,
            }}
          >
            Add photo
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AddNoteModal({
  visible,
  editNote,
  onClose,
  onSubmit,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [category, setCategory] = useState<NoteCategory>("general");
  const [severity, setSeverity] = useState<NoteSeverity>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(todayISO());
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (visible && editNote) {
      setCategory(editNote.category as NoteCategory);
      setSeverity((editNote.severity as NoteSeverity) ?? null);
      setTitle(editNote.title);
      setBody(editNote.body);
      setDate(
        typeof editNote.date === "string"
          ? editNote.date
          : todayISO()
      );
      setPhotos(editNote.photoData ?? []);
    } else if (visible && !editNote) {
      setCategory("general");
      setSeverity(null);
      setTitle("");
      setBody("");
      setDate(todayISO());
      setPhotos([]);
    }
  }, [visible, editNote]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const catMeta =
    CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[5];

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please grant photo library access to attach photos."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.55,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const dataUri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setPhotos((prev) => [...prev, dataUri].slice(0, 3));
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please add a short title for this note.");
      return;
    }
    if (!body.trim()) {
      Alert.alert(
        "Description required",
        "Please describe what you observed."
      );
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ date, category, severity, title: title.trim(), body: body.trim(), photoData: photos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert("Error", "Failed to save note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, { color: colors.foreground }]}
            >
              {editNote ? "Edit Note" : "New Scouting Note"}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons
                name="close-circle"
                size={26}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, gap: 18 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Category picker */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Category
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.value;
                    return (
                      <Pressable
                        key={cat.value}
                        onPress={() => {
                          setCategory(cat.value);
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active
                              ? cat.color + "18"
                              : colors.muted,
                            borderColor: active ? cat.color : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={14}
                          color={active ? cat.color : colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: active
                                ? cat.color
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Severity picker */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Severity{" "}
                  <Text style={{ fontFamily: "Outfit_400Regular" }}>
                    (optional)
                  </Text>
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SEVERITIES.map((sev) => {
                    const active = severity === sev.value;
                    return (
                      <Pressable
                        key={sev.value}
                        onPress={() => {
                          setSeverity(active ? null : sev.value);
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active
                              ? sev.color + "18"
                              : colors.muted,
                            borderColor: active ? sev.color : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: active
                                ? sev.color
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {sev.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Title */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Title
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Aphid colony on north row"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.muted,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                  maxLength={120}
                  returnKeyType="next"
                />
              </View>

              {/* Body */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Observations
                </Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Describe what you observed, where in the field, estimated extent…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    styles.textarea,
                    {
                      backgroundColor: colors.muted,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>

              {/* Photos */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Photos{" "}
                  <Text style={{ fontFamily: "Outfit_400Regular" }}>
                    (up to 3)
                  </Text>
                </Text>
                <PhotoStrip
                  photos={photos}
                  onAdd={pickPhoto}
                  onRemove={(i) =>
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Submit button */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                { backgroundColor: catMeta.color, opacity: submitting ? 0.6 : 1 },
              ]}
              activeOpacity={0.82}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {editNote ? "Save Changes" : "Save Note"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    minHeight: 400,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  textarea: {
    height: 110,
    paddingTop: 12,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Outfit_700Bold",
    color: "#fff",
  },
});
