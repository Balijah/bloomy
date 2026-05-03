/**
 * DatePickerField
 *
 * Cross-platform date picker field.
 *   - iOS / Android: displays a labelled pressable row; on press opens the
 *     native DateTimePicker spinner in a modal-style sheet.
 *   - Web: renders a plain text input (YYYY-MM-DD) since the native picker
 *     is not available in the browser.
 *
 * The value / onChange contract uses ISO date strings ("YYYY-MM-DD") or an
 * empty string when not set — matching the existing farm profile schema.
 */

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  clearable?: boolean;
}

// ── Web fallback ──────────────────────────────────────────────────────────────

function WebDateField({ label, value, onChange, placeholder, colors }: Props & { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[wf.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? "YYYY-MM-DD"}
        placeholderTextColor={colors.mutedForeground}
        style={[
          wf.input,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: "Outfit_400Regular",
          },
        ]}
      />
    </View>
  );
}

const wf = StyleSheet.create({
  label: { fontSize: 13, fontFamily: "Outfit_500Medium" },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});

// ── Native picker ─────────────────────────────────────────────────────────────

export default function DatePickerField(props: Props) {
  const { label, value, onChange, minDate, maxDate, clearable = true } = props;
  const colors = useColors();
  const [open, setOpen] = useState(false);

  // Web fallback
  if (Platform.OS === "web") {
    return <WebDateField {...props} colors={colors} />;
  }

  const displayValue = value ? formatDisplay(value) : "";
  const hasValue = !!value;

  function handleChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (date) onChange(dateToIso(date));
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          s.field,
          {
            backgroundColor: colors.muted,
            borderColor: open ? colors.primary : colors.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={16}
          color={hasValue ? colors.primary : colors.mutedForeground}
          style={{ marginRight: 2 }}
        />
        <Text
          style={[
            s.fieldText,
            {
              color: hasValue ? colors.foreground : colors.mutedForeground,
              fontFamily: hasValue ? "Outfit_500Medium" : "Outfit_400Regular",
            },
          ]}
          numberOfLines={1}
        >
          {hasValue ? displayValue : "Tap to select a date"}
        </Text>
        {hasValue && clearable && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={8}
            style={s.clearBtn}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
        {!hasValue && (
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.mutedForeground}
          />
        )}
      </Pressable>

      {/* iOS: show picker inline in a modal bottom sheet */}
      {Platform.OS === "ios" && open && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            style={s.backdrop}
            onPress={() => setOpen(false)}
          />
          <View
            style={[s.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}
          >
            <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
              {clearable && hasValue ? (
                <TouchableOpacity onPress={handleClear}>
                  <Text style={[s.sheetAction, { color: "#E05820" }]}>Clear</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 60 }} />
              )}
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>
                {label}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={[s.sheetAction, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={isoToDate(value)}
              mode="date"
              display="spinner"
              onChange={handleChange}
              minimumDate={minDate}
              maximumDate={maxDate}
              style={{ alignSelf: "center" }}
            />
          </View>
        </Modal>
      )}

      {/* Android: native dialog (no modal needed — picker opens as dialog) */}
      {Platform.OS === "android" && open && (
        <DateTimePicker
          value={isoToDate(value)}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minDate}
          maximumDate={maxDate}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontFamily: "Outfit_500Medium" },
  field: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldText: { flex: 1, fontSize: 15 },
  clearBtn: { padding: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000055",
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, fontFamily: "Outfit_600SemiBold" },
  sheetAction: { fontSize: 15, fontFamily: "Outfit_600SemiBold" },
});
