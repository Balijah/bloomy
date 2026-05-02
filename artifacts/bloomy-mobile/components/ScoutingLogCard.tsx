/**
 * ScoutingLogCard — field notes / scouting log on the farm detail screen.
 *
 * Displays a chronological list of scout notes with category icons, severity
 * badges, and photo thumbnails.  An "Add Note" FAB opens the AddNoteModal.
 * Swipe-reveal delete (long-press on iOS, visible trash on Android) lets
 * farmers remove outdated entries.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useGetFieldNotes,
  useCreateFieldNote,
  useUpdateFieldNote,
  useDeleteFieldNote,
  getGetFieldNotesQueryKey,
} from "@workspace/api-client-react";
import type { FieldNote } from "@workspace/api-client-react";
import {
  generateScoutingReportHtml,
  filterExportNotes,
} from "@/lib/scoutingReport";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import AddNoteModal, { type NoteFormData } from "./AddNoteModal";

// ── Category metadata ─────────────────────────────────────────────────────────

const CAT_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  pest:      { icon: "bug-outline",          color: "#B94040", label: "Pest" },
  disease:   { icon: "medical-outline",      color: "#A0509A", label: "Disease" },
  soil:      { icon: "layers-outline",       color: "#8B5E3C", label: "Soil" },
  weather:   { icon: "partly-sunny-outline", color: "#2860A8", label: "Weather" },
  irrigation:{ icon: "water-outline",        color: "#0E7490", label: "Irrigation" },
  general:   { icon: "clipboard-outline",    color: "#5A6A72", label: "General" },
};

const SEV_META: Record<string, { color: string; label: string }> = {
  low:      { color: "#1A7340", label: "Low" },
  medium:   { color: "#B97B14", label: "Medium" },
  high:     { color: "#C25214", label: "High" },
  critical: { color: "#9B1C1C", label: "Critical" },
};

// ── Friendly date ─────────────────────────────────────────────────────────────

function formatNoteDate(raw: string): string {
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dt.toDateString() === today.toDateString()) return "Today";
  if (dt.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: dt.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

// ── Single note row ───────────────────────────────────────────────────────────

function NoteRow({
  note,
  onEdit,
  onDelete,
}: {
  note: FieldNote;
  onEdit: (n: FieldNote) => void;
  onDelete: (id: number) => void;
}) {
  const colors = useColors();
  const cat = CAT_META[note.category] ?? CAT_META.general;
  const sev = note.severity ? SEV_META[note.severity] : null;
  const [expanded, setExpanded] = useState(false);
  const deleteX = useRef(new Animated.Value(0)).current;
  const [swipeOpen, setSwipeOpen] = useState(false);

  const dateStr =
    typeof note.date === "string"
      ? note.date
      : (note.date as any) instanceof Date
      ? (note.date as any).toISOString().slice(0, 10)
      : String(note.date).slice(0, 10);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.card,
      }}
    >
      {/* Main row */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert("Delete Note", "Remove this scouting note?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => onDelete(note.id),
            },
          ]);
        }}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          padding: 12,
          gap: 12,
        }}
      >
        {/* Category icon badge */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: cat.color + "18",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          <Ionicons name={cat.icon as any} size={18} color={cat.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 3 }}>
          {/* Title + date row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: "Outfit_600SemiBold",
                color: colors.foreground,
                lineHeight: 20,
              }}
              numberOfLines={expanded ? undefined : 1}
            >
              {note.title}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {formatNoteDate(dateStr)}
            </Text>
          </View>

          {/* Badges row */}
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: cat.color + "12",
                borderRadius: 99,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_600SemiBold",
                  color: cat.color,
                }}
              >
                {cat.label}
              </Text>
            </View>
            {sev && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: sev.color + "12",
                  borderRadius: 99,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: sev.color,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Outfit_600SemiBold",
                    color: sev.color,
                  }}
                >
                  {sev.label}
                </Text>
              </View>
            )}
            {note.photoData && note.photoData.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: colors.muted,
                  borderRadius: 99,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Ionicons
                  name="camera-outline"
                  size={11}
                  color={colors.mutedForeground}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Outfit_500Medium",
                    color: colors.mutedForeground,
                  }}
                >
                  {note.photoData.length}
                </Text>
              </View>
            )}
          </View>

          {/* Body (collapsed: 2 lines, expanded: full) */}
          {!expanded && (
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Outfit_400Regular",
                color: colors.mutedForeground,
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {note.body}
            </Text>
          )}
        </View>

        {/* Chevron */}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
          style={{ marginTop: 4 }}
        />
      </Pressable>

      {/* Expanded body + photos */}
      {expanded && (
        <>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ padding: 12, gap: 12 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Outfit_400Regular",
                color: colors.foreground,
                lineHeight: 21,
              }}
            >
              {note.body}
            </Text>

            {/* Photos */}
            {note.photoData && note.photoData.length > 0 && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {note.photoData.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 10,
                      backgroundColor: colors.muted,
                    }}
                  />
                ))}
              </View>
            )}

            {/* Edit / Delete actions */}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                onPress={() => onEdit(note)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Outfit_500Medium",
                    color: colors.mutedForeground,
                  }}
                >
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Delete Note", "Remove this scouting note?", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => onDelete(note.id),
                    },
                  ])
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: "#9B1C1C12",
                  borderWidth: 1,
                  borderColor: "#9B1C1C30",
                }}
              >
                <Ionicons name="trash-outline" size={14} color="#9B1C1C" />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Outfit_600SemiBold",
                    color: "#9B1C1C",
                  }}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 28,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="clipboard-outline" size={26} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          fontSize: 15,
          fontFamily: "Outfit_600SemiBold",
          color: colors.foreground,
        }}
      >
        No notes yet
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Outfit_400Regular",
          color: colors.mutedForeground,
          textAlign: "center",
          maxWidth: 240,
          lineHeight: 19,
        }}
      >
        Record pest sightings, disease symptoms, soil observations, and more.
      </Text>
      <TouchableOpacity
        onPress={onAdd}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: "#366441",
        }}
        activeOpacity={0.82}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Outfit_600SemiBold",
            color: "#fff",
          }}
        >
          Add First Note
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface Props {
  farmProfileId: number;
  farmName?: string;
}

export default function ScoutingLogCard({ farmProfileId, farmName }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<FieldNote | null>(null);
  const [sharing, setSharing] = useState(false);

  const { data: notes, isLoading } = useGetFieldNotes(farmProfileId);

  const createMutation = useCreateFieldNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetFieldNotesQueryKey(farmProfileId),
        });
      },
    },
  });

  const updateMutation = useUpdateFieldNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetFieldNotesQueryKey(farmProfileId),
        });
      },
    },
  });

  const deleteMutation = useDeleteFieldNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetFieldNotesQueryKey(farmProfileId),
        });
      },
    },
  });

  async function handleExport() {
    const allNotes = notes ?? [];
    const exportable = filterExportNotes(allNotes);

    if (exportable.length === 0) {
      Alert.alert(
        "Nothing to export",
        "There are no critical or high severity scouting notes for this farm.",
        [{ text: "OK" }]
      );
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("Not supported", "PDF export is not available on web.");
      return;
    }

    try {
      setSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = generateScoutingReportHtml({
        farmName: farmName ?? "Farm",
        notes: allNotes,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${farmName ?? "Farm"} — Scouting Report`,
        UTI: "com.adobe.pdf",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_err) {
      // sharing cancelled or unsupported — silently ignore
    } finally {
      setSharing(false);
    }
  }

  function openAdd() {
    setEditingNote(null);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function openEdit(note: FieldNote) {
    setEditingNote(note);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id: farmProfileId, noteId: id });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSubmit(data: NoteFormData) {
    if (editingNote) {
      await updateMutation.mutateAsync({
        id: farmProfileId,
        noteId: editingNote.id,
        data: {
          date: data.date,
          category: data.category as any,
          severity: data.severity as any,
          title: data.title,
          body: data.body,
          photoData: data.photoData.length > 0 ? data.photoData : null,
        },
      });
    } else {
      await createMutation.mutateAsync({
        id: farmProfileId,
        data: {
          date: data.date,
          category: data.category as any,
          severity: data.severity as any,
          title: data.title,
          body: data.body,
          photoData: data.photoData.length > 0 ? data.photoData : null,
        },
      });
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 16,
        }}
      >
        {/* Icon + title */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#366441" + "14",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="clipboard" size={18} color="#366441" />
          </View>
          <View>
            <Text
              style={{
                fontSize: 17,
                fontFamily: "Outfit_700Bold",
                color: colors.foreground,
              }}
            >
              Scouting Log
            </Text>
            {notes && notes.length > 0 && (() => {
              const critHighCount = filterExportNotes(notes).length;
              return (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Outfit_400Regular",
                    color: colors.mutedForeground,
                  }}
                >
                  {notes.length} note{notes.length !== 1 ? "s" : ""}
                  {critHighCount > 0 ? ` · ${critHighCount} critical/high` : ""}
                </Text>
              );
            })()}
          </View>
        </View>

        {/* Share report button */}
        {notes && notes.length > 0 && (
          <TouchableOpacity
            onPress={handleExport}
            disabled={sharing}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 11,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: sharing ? 0.6 : 1,
            }}
            activeOpacity={0.82}
          >
            {sharing ? (
              <ActivityIndicator size={14} color="#366441" />
            ) : (
              <Ionicons name="share-outline" size={15} color="#366441" />
            )}
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_600SemiBold",
                color: "#366441",
              }}
            >
              {sharing ? "Exporting…" : "Share"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Add button */}
        <TouchableOpacity
          onPress={openAdd}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: "#366441",
          }}
          activeOpacity={0.82}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_600SemiBold",
              color: "#fff",
            }}
          >
            Add Note
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <View style={{ padding: 16, gap: 12 }}>
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <ActivityIndicator color="#366441" />
          </View>
        ) : !notes || notes.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </View>

      {/* ── Add note modal ─────────────────────────────────────────────────── */}
      <AddNoteModal
        visible={modalVisible}
        editNote={editingNote}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
