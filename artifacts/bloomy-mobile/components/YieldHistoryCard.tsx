/**
 * YieldHistoryCard
 *
 * Shows a year-over-year bar chart of logged harvest yields compared to the
 * USDA regional average for the crop. Farmers can log, edit, and delete
 * individual harvest records inline.
 *
 * Requires: react-native-svg (already installed)
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import {
  useGetYieldRecords,
  useCreateYieldRecord,
  useUpdateYieldRecord,
  useDeleteYieldRecord,
  getGetYieldRecordsQueryKey,
  type YieldRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { YIELD_PROFILES_PUBLIC } from "@/lib/yieldForecast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  farmProfileId: number;
  cropType: string;
  yieldGoal?: number | null;
}

// ── Chart constants ───────────────────────────────────────────────────────────

const CHART_H = 180;
const BAR_RADIUS = 4;
const LABEL_H = 20;
const AXIS_W = 42;
const TICK_COUNT = 4;

function buildChartData(
  records: YieldRecord[],
  avg: number,
  goalValue: number | null | undefined
) {
  const allVals = records.map((r) => r.actualYield);
  const cap = Math.max(...allVals, avg, goalValue ?? 0) * 1.15;
  const floor = 0;

  return { cap, floor };
}

function yToPixel(val: number, cap: number, height: number): number {
  return height - (val / cap) * height;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChart({
  colors,
  onAdd,
}: {
  colors: ReturnType<typeof useColors>;
  onAdd: () => void;
}) {
  return (
    <View style={[em.wrap, { borderColor: colors.border }]}>
      <Ionicons name="bar-chart-outline" size={36} color={colors.mutedForeground} />
      <Text style={[em.title, { color: colors.foreground }]}>No yield history yet</Text>
      <Text style={[em.body, { color: colors.mutedForeground }]}>
        Log your first harvest to start tracking year-over-year performance.
      </Text>
      <Pressable
        style={[em.btn, { backgroundColor: "#366441" }]}
        onPress={onAdd}
      >
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={em.btnText}>Log first harvest</Text>
      </Pressable>
    </View>
  );
}

const em = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 15, fontFamily: "Outfit_600SemiBold", marginTop: 4 },
  body: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 99,
  },
  btnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#fff" },
});

// ── Log / edit modal ──────────────────────────────────────────────────────────

function RecordModal({
  visible,
  editing,
  cropType,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  editing: YieldRecord | null;
  cropType: string;
  onClose: () => void;
  onSave: (year: number, yield_: number, notes: string) => void;
  saving: boolean;
}) {
  const colors = useColors();
  const profile = YIELD_PROFILES_PUBLIC[cropType];

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(
    editing ? String(editing.harvestYear) : String(currentYear - 1)
  );
  const [yieldVal, setYieldVal] = useState(
    editing ? String(editing.actualYield) : ""
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  React.useEffect(() => {
    if (visible) {
      setYear(editing ? String(editing.harvestYear) : String(currentYear - 1));
      setYieldVal(editing ? String(editing.actualYield) : "");
      setNotes(editing?.notes ?? "");
    }
  }, [visible, editing]);

  const unit = profile?.unit ?? "units/acre";
  const canSave = year.trim().length === 4 && !!yieldVal && !isNaN(parseFloat(yieldVal));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={md.backdrop} onPress={onClose} />
      <View style={[md.sheet, { backgroundColor: colors.card }]}>
        <View style={md.handle} />
        <Text style={[md.title, { color: colors.foreground }]}>
          {editing ? "Edit yield record" : "Log harvest"}
        </Text>

        {/* Year */}
        <View style={md.field}>
          <Text style={[md.label, { color: colors.mutedForeground }]}>Harvest year</Text>
          <TextInput
            style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={String(currentYear - 1)}
            placeholderTextColor={colors.mutedForeground}
            editable={!editing}
          />
        </View>

        {/* Yield */}
        <View style={md.field}>
          <Text style={[md.label, { color: colors.mutedForeground }]}>
            Actual yield · {unit}
          </Text>
          <TextInput
            style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={yieldVal}
            onChangeText={setYieldVal}
            keyboardType="decimal-pad"
            placeholder={profile ? `avg ${profile.avg}` : "e.g. 180"}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Notes */}
        <View style={md.field}>
          <Text style={[md.label, { color: colors.mutedForeground }]}>Notes (optional)</Text>
          <TextInput
            style={[md.input, md.multiline, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Weather events, variety, irrigation details…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={md.row}>
          <Pressable
            style={[md.btn, { backgroundColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[md.btnText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[md.btn, { backgroundColor: canSave ? "#366441" : colors.border, flex: 1 }]}
            onPress={() => canSave && onSave(parseInt(year), parseFloat(yieldVal), notes)}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[md.btnText, { color: canSave ? "#fff" : colors.mutedForeground }]}>
                {editing ? "Save changes" : "Log harvest"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const md = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontFamily: "Outfit_700Bold", marginBottom: 4 },
  field: { gap: 4 },
  label: { fontSize: 12, fontFamily: "Outfit_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  multiline: { height: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: {
    flex: 0.45,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold" },
});

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({
  records,
  cropType,
  yieldGoal,
  colors,
  onPressBar,
}: {
  records: YieldRecord[];
  cropType: string;
  yieldGoal: number | null | undefined;
  colors: ReturnType<typeof useColors>;
  onPressBar: (r: YieldRecord) => void;
}) {
  const profile = YIELD_PROFILES_PUBLIC[cropType];
  const avg = profile?.avg ?? 100;
  const unit = profile?.unit ?? "units/acre";

  const { cap } = buildChartData(records, avg, yieldGoal);

  // Responsive bar width
  const [chartWidth, setChartWidth] = useState(300);
  const innerW = chartWidth - AXIS_W;
  const n = records.length;
  const gap = Math.max(4, Math.min(10, innerW / (n * 3)));
  const barW = Math.max(18, Math.min(44, (innerW - gap * (n + 1)) / n));

  // Ticks
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    Math.round((cap / TICK_COUNT) * i)
  );

  const avgY = yToPixel(avg, cap, CHART_H);
  const goalY =
    yieldGoal != null ? yToPixel(yieldGoal, cap, CHART_H) : null;

  return (
    <View>
      <View
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        style={{ width: "100%" }}
      >
        <Svg width={chartWidth} height={CHART_H + LABEL_H}>
          {/* Y-axis ticks & labels */}
          {ticks.map((t, i) => {
            const y = yToPixel(t, cap, CHART_H);
            return (
              <G key={i}>
                <Line
                  x1={AXIS_W}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? "0" : "3,3"}
                />
                <SvgText
                  x={AXIS_W - 4}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={9}
                  fontFamily="Outfit_400Regular"
                  fill={colors.mutedForeground}
                >
                  {t}
                </SvgText>
              </G>
            );
          })}

          {/* USDA average line */}
          <Line
            x1={AXIS_W}
            y1={avgY}
            x2={chartWidth}
            y2={avgY}
            stroke="#E8A020"
            strokeWidth={1.5}
            strokeDasharray="5,4"
          />
          <SvgText
            x={chartWidth - 2}
            y={avgY - 4}
            textAnchor="end"
            fontSize={8.5}
            fontFamily="Outfit_600SemiBold"
            fill="#E8A020"
          >
            USDA avg
          </SvgText>

          {/* Yield goal line */}
          {goalY != null && yieldGoal != null && (
            <>
              <Line
                x1={AXIS_W}
                y1={goalY}
                x2={chartWidth}
                y2={goalY}
                stroke="#366441"
                strokeWidth={1.5}
                strokeDasharray="5,4"
              />
              <SvgText
                x={chartWidth - 2}
                y={goalY - 4}
                textAnchor="end"
                fontSize={8.5}
                fontFamily="Outfit_600SemiBold"
                fill="#366441"
              >
                Goal
              </SvgText>
            </>
          )}

          {/* Bars */}
          {records.map((r, i) => {
            const x = AXIS_W + gap + i * (barW + gap);
            const barH = Math.max(
              4,
              ((r.actualYield / cap) * CHART_H)
            );
            const barY = CHART_H - barH;
            const aboveAvg = r.actualYield >= avg;
            const fill = aboveAvg ? "#4D8A5E" : "#C15A3A";
            const labelY = CHART_H + LABEL_H - 2;

            return (
              <G key={r.id} onPress={() => onPressBar(r)}>
                <Rect
                  x={x}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={BAR_RADIUS}
                  ry={BAR_RADIUS}
                  fill={fill}
                  opacity={0.85}
                />
                {/* Value label on bar */}
                {barH > 22 && (
                  <SvgText
                    x={x + barW / 2}
                    y={barY + 13}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="Outfit_700Bold"
                    fill="#fff"
                  >
                    {r.actualYield % 1 === 0
                      ? r.actualYield
                      : r.actualYield.toFixed(1)}
                  </SvgText>
                )}
                {/* Year label */}
                <SvgText
                  x={x + barW / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="Outfit_400Regular"
                  fill={colors.mutedForeground}
                >
                  {String(r.harvestYear).slice(2)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legend */}
      <View style={ch.legend}>
        <View style={ch.legendItem}>
          <View style={[ch.legendDot, { backgroundColor: "#4D8A5E" }]} />
          <Text style={[ch.legendText, { color: colors.mutedForeground }]}>Above avg</Text>
        </View>
        <View style={ch.legendItem}>
          <View style={[ch.legendDot, { backgroundColor: "#C15A3A" }]} />
          <Text style={[ch.legendText, { color: colors.mutedForeground }]}>Below avg</Text>
        </View>
        <View style={ch.legendItem}>
          <View style={[ch.legendLine, { backgroundColor: "#E8A020" }]} />
          <Text style={[ch.legendText, { color: colors.mutedForeground }]}>USDA avg ({avg} {unit})</Text>
        </View>
        {yieldGoal != null && (
          <View style={ch.legendItem}>
            <View style={[ch.legendLine, { backgroundColor: "#366441" }]} />
            <Text style={[ch.legendText, { color: colors.mutedForeground }]}>Goal ({yieldGoal} {unit})</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, fontFamily: "Outfit_400Regular" },
});

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({
  records,
  avg,
  unit,
  colors,
}: {
  records: YieldRecord[];
  avg: number;
  unit: string;
  colors: ReturnType<typeof useColors>;
}) {
  const vals = records.map((r) => r.actualYield);
  const farmAvg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const farmHigh = Math.max(...vals);
  const farmLow = Math.min(...vals);
  const vsUsda = farmAvg - avg;

  return (
    <View style={st.row}>
      <View style={[st.cell, { borderColor: colors.border }]}>
        <Text style={[st.val, { color: colors.foreground }]}>
          {farmAvg % 1 === 0 ? farmAvg : farmAvg.toFixed(1)}
        </Text>
        <Text style={[st.lbl, { color: colors.mutedForeground }]}>Farm avg</Text>
      </View>
      <View style={[st.cell, { borderColor: colors.border }]}>
        <Text style={[st.val, { color: "#2D9B5A" }]}>{farmHigh}</Text>
        <Text style={[st.lbl, { color: colors.mutedForeground }]}>Best year</Text>
      </View>
      <View style={[st.cell, { borderColor: colors.border }]}>
        <Text style={[st.val, { color: "#C15A3A" }]}>{farmLow}</Text>
        <Text style={[st.lbl, { color: colors.mutedForeground }]}>Worst year</Text>
      </View>
      <View style={[st.cell, { borderColor: colors.border }]}>
        <Text
          style={[
            st.val,
            { color: vsUsda >= 0 ? "#2D9B5A" : "#C15A3A" },
          ]}
        >
          {vsUsda >= 0 ? "+" : ""}
          {vsUsda % 1 === 0 ? vsUsda : vsUsda.toFixed(1)}
        </Text>
        <Text style={[st.lbl, { color: colors.mutedForeground }]}>vs USDA avg</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  val: { fontSize: 18, fontFamily: "Outfit_700Bold", lineHeight: 22 },
  lbl: { fontSize: 9, fontFamily: "Outfit_400Regular", textAlign: "center" },
});

// ── Records list (tap to edit/delete) ────────────────────────────────────────

function RecordRow({
  record,
  unit,
  avg,
  colors,
  onEdit,
  onDelete,
}: {
  record: YieldRecord;
  unit: string;
  avg: number;
  colors: ReturnType<typeof useColors>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const diff = record.actualYield - avg;
  const diffColor = diff >= 0 ? "#2D9B5A" : "#C15A3A";

  return (
    <View style={[rl.row, { borderBottomColor: colors.border }]}>
      <View style={rl.left}>
        <Text style={[rl.year, { color: colors.foreground }]}>{record.harvestYear}</Text>
        <Text style={[rl.yield_, { color: colors.foreground }]}>
          {record.actualYield} {unit}
        </Text>
        {record.notes ? (
          <Text style={[rl.notes, { color: colors.mutedForeground }]} numberOfLines={1}>
            {record.notes}
          </Text>
        ) : null}
      </View>
      <View style={rl.right}>
        <Text style={[rl.diff, { color: diffColor }]}>
          {diff >= 0 ? "+" : ""}{diff % 1 === 0 ? diff : diff.toFixed(1)} vs avg
        </Text>
        <View style={rl.actions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color="#C15A3A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const rl = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { gap: 2, flex: 1 },
  right: { alignItems: "flex-end", gap: 6 },
  year: { fontSize: 11, fontFamily: "Outfit_500Medium" },
  yield_: { fontSize: 14, fontFamily: "Outfit_700Bold" },
  notes: { fontSize: 11, fontFamily: "Outfit_400Regular", maxWidth: 200 },
  diff: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  actions: { flexDirection: "row", gap: 14 },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function YieldHistoryCard({ farmProfileId, cropType, yieldGoal }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const profile = YIELD_PROFILES_PUBLIC[cropType];
  const avg = profile?.avg ?? 100;
  const unit = profile?.unit ?? "units/acre";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<YieldRecord | null>(null);
  const [showRecords, setShowRecords] = useState(false);

  const { data: records = [], isLoading } = useGetYieldRecords(farmProfileId);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getGetYieldRecordsQueryKey(farmProfileId),
    });

  const { mutate: create, isPending: creating } = useCreateYieldRecord({
    mutation: { onSuccess: () => { invalidate(); setModalOpen(false); } },
  });
  const { mutate: update, isPending: updating } = useUpdateYieldRecord({
    mutation: { onSuccess: () => { invalidate(); setModalOpen(false); setEditing(null); } },
  });
  const { mutate: delete_ } = useDeleteYieldRecord({
    mutation: { onSuccess: invalidate },
  });

  function handleSave(year: number, yield_: number, notes: string) {
    if (editing) {
      update({
        id: farmProfileId,
        recordId: editing.id,
        data: { actualYield: yield_, notes: notes.trim() || null },
      });
    } else {
      create({
        id: farmProfileId,
        data: { harvestYear: year, actualYield: yield_, notes: notes.trim() || null },
      });
    }
  }

  function handleDelete(record: YieldRecord) {
    Alert.alert(
      "Delete yield record",
      `Remove the ${record.harvestYear} harvest entry (${record.actualYield} ${unit})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            delete_({ id: farmProfileId, recordId: record.id }),
        },
      ]
    );
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(record: YieldRecord) {
    setEditing(record);
    setModalOpen(true);
  }

  if (isLoading) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color="#366441" />
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.iconWrap, { backgroundColor: "#366441" + "18" }]}>
            <Ionicons name="bar-chart" size={20} color="#366441" />
          </View>
          <View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Yield History</Text>
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>
              {records.length > 0
                ? `${records.length} season${records.length !== 1 ? "s" : ""} logged`
                : "No seasons logged"}
            </Text>
          </View>
        </View>
        <Pressable
          style={[s.addBtn, { backgroundColor: "#366441" }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.addBtnText}>Log year</Text>
        </Pressable>
      </View>

      {/* Content */}
      {records.length === 0 ? (
        <EmptyChart colors={colors} onAdd={openAdd} />
      ) : (
        <>
          {/* Stats */}
          <StatsRow records={records} avg={avg} unit={unit} colors={colors} />

          {/* Chart */}
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <BarChart
            records={records}
            cropType={cropType}
            yieldGoal={yieldGoal}
            colors={colors}
            onPressBar={openEdit}
          />

          {/* Records list toggle */}
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={s.toggleRow}
            onPress={() => setShowRecords((v) => !v)}
          >
            <Text style={[s.toggleText, { color: colors.mutedForeground }]}>
              {showRecords ? "Hide" : "Show"} all records
            </Text>
            <Ionicons
              name={showRecords ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.mutedForeground}
            />
          </Pressable>
          {showRecords && (
            <View>
              {[...records].reverse().map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  unit={unit}
                  avg={avg}
                  colors={colors}
                  onEdit={() => openEdit(r)}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={12} color={colors.mutedForeground} />
        <Text style={[s.footerText, { color: colors.mutedForeground }]}>
          Reference line shows USDA NASS national average for {profile?.unitLong ?? cropType}. Tap a bar to edit.
        </Text>
      </View>

      {/* Log/edit modal */}
      <RecordModal
        visible={modalOpen}
        editing={editing}
        cropType={cropType}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        saving={creating || updating}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Outfit_700Bold" },
  cardSub: { fontSize: 12, fontFamily: "Outfit_400Regular", marginTop: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  addBtnText: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: "#fff" },
  divider: { height: StyleSheet.hairlineWidth },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
  },
  toggleText: { fontSize: 12, fontFamily: "Outfit_500Medium" },
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Outfit_400Regular",
    lineHeight: 14,
  },
});
