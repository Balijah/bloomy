/**
 * InputCostCard
 *
 * Tracks individual field-level input expense line items grouped by category.
 * Computes a running total cost/acre and compares it against the farm profile's
 * breakeven cost-per-acre estimate, with a one-tap sync action when they differ.
 *
 * Cost entry supports two modes:
 *   • Direct: cost per acre
 *   • Total: total spend + acres applied  → auto-derives cost/acre
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
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
import {
  useGetInputCosts,
  useCreateInputCost,
  useUpdateInputCost,
  useDeleteInputCost,
  useUpdateFarmProfile,
  getGetInputCostsQueryKey,
  getGetFarmProfileQueryKey,
  type InputCost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

// ── Category metadata ─────────────────────────────────────────────────────────

type Category =
  | "seed"
  | "fertilizer"
  | "herbicide"
  | "pesticide"
  | "fuel"
  | "labor"
  | "custom_operation"
  | "equipment"
  | "irrigation"
  | "drying"
  | "other";

const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; color: string; hint: number }
> = {
  seed:             { label: "Seed",             icon: "leaf",                color: "#4D8A5E", hint: 120 },
  fertilizer:       { label: "Fertilizer",       icon: "flask",               color: "#366441", hint: 180 },
  herbicide:        { label: "Herbicide",         icon: "leaf-outline",        color: "#8B7355", hint: 60  },
  pesticide:        { label: "Pesticide",         icon: "bug",                 color: "#7B5EA7", hint: 25  },
  fuel:             { label: "Fuel",              icon: "car",                 color: "#C15A3A", hint: 35  },
  labor:            { label: "Labor",             icon: "people",              color: "#2D7DD2", hint: 30  },
  custom_operation: { label: "Custom Op",         icon: "hammer",              color: "#E8A020", hint: 50  },
  equipment:        { label: "Equipment",         icon: "construct",           color: "#5B5B5B", hint: 150 },
  irrigation:       { label: "Irrigation",        icon: "water",               color: "#0EA5E9", hint: 0   },
  drying:           { label: "Drying",            icon: "thermometer",         color: "#DC6803", hint: 35  },
  other:            { label: "Other",             icon: "ellipsis-horizontal", color: "#6B7280", hint: 0   },
};

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

// ── Cost helpers ──────────────────────────────────────────────────────────────

function effectiveCostPerAcre(
  item: InputCost,
  farmAcreage: number | null | undefined
): number | null {
  if (item.costPerAcre != null) return item.costPerAcre;
  if (item.totalCost != null) {
    const acres = item.acresApplied ?? farmAcreage;
    if (acres && acres > 0) return item.totalCost / acres;
  }
  return null;
}

function totalTrackedPerAcre(
  items: InputCost[],
  farmAcreage: number | null | undefined
): number {
  return items.reduce((sum, it) => {
    const cpa = effectiveCostPerAcre(it, farmAcreage);
    return sum + (cpa ?? 0);
  }, 0);
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  colors,
  onAdd,
}: {
  colors: ReturnType<typeof useColors>;
  onAdd: () => void;
}) {
  return (
    <View style={[em.wrap, { borderColor: colors.border }]}>
      <Ionicons name="receipt-outline" size={36} color={colors.mutedForeground} />
      <Text style={[em.title, { color: colors.foreground }]}>No input costs logged</Text>
      <Text style={[em.body, { color: colors.mutedForeground }]}>
        Track seed, fertilizer, herbicide, and other field expenses to see how
        they compare to your breakeven estimate.
      </Text>
      <Pressable style={[em.btn, { backgroundColor: "#366441" }]} onPress={onAdd}>
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={em.btnText}>Add first expense</Text>
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
    gap: 10,
  },
  title: { fontSize: 15, fontFamily: "Outfit_600SemiBold", marginTop: 4 },
  body: { fontSize: 13, fontFamily: "Outfit_400Regular", textAlign: "center", lineHeight: 18 },
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

// ── Add / edit modal ──────────────────────────────────────────────────────────

type EntryMode = "perAcre" | "total";

function CostModal({
  visible,
  editing,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  editing: InputCost | null;
  onClose: () => void;
  onSave: (data: {
    category: Category;
    item: string;
    costPerAcre: number | null;
    totalCost: number | null;
    acresApplied: number | null;
    notes: string;
  }) => void;
  saving: boolean;
}) {
  const colors = useColors();

  const [category, setCategory] = useState<Category>("other");
  const [item, setItem] = useState("");
  const [mode, setMode] = useState<EntryMode>("perAcre");
  const [costPerAcre, setCostPerAcre] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [acresApplied, setAcresApplied] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) {
      if (editing) {
        setCategory((editing.category as Category) ?? "other");
        setItem(editing.item ?? "");
        if (editing.totalCost != null) {
          setMode("total");
          setTotalCost(String(editing.totalCost));
          setAcresApplied(editing.acresApplied != null ? String(editing.acresApplied) : "");
          setCostPerAcre("");
        } else {
          setMode("perAcre");
          setCostPerAcre(editing.costPerAcre != null ? String(editing.costPerAcre) : "");
          setTotalCost("");
          setAcresApplied("");
        }
        setNotes(editing.notes ?? "");
      } else {
        setCategory("other");
        setItem("");
        setMode("perAcre");
        setCostPerAcre("");
        setTotalCost("");
        setAcresApplied("");
        setNotes("");
      }
    }
  }, [visible, editing]);

  const meta = CATEGORY_META[category];
  const canSave =
    item.trim().length > 0 &&
    (mode === "perAcre" ? !!costPerAcre : !!totalCost);

  function handleSave() {
    if (!canSave) return;
    onSave({
      category,
      item: item.trim(),
      costPerAcre: mode === "perAcre" && costPerAcre ? parseFloat(costPerAcre) : null,
      totalCost: mode === "total" && totalCost ? parseFloat(totalCost) : null,
      acresApplied: acresApplied ? parseFloat(acresApplied) : null,
      notes: notes.trim(),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={md.backdrop} onPress={onClose} />
      <View style={[md.sheet, { backgroundColor: colors.card }]}>
        <View style={md.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 14 }}
        >
          <Text style={[md.title, { color: colors.foreground }]}>
            {editing ? "Edit expense" : "Log expense"}
          </Text>

          {/* Category picker */}
          <View style={{ gap: 6 }}>
            <Text style={[md.label, { color: colors.mutedForeground }]}>Category</Text>
            <View style={md.catGrid}>
              {CATEGORIES.map((cat) => {
                const m = CATEGORY_META[cat];
                const sel = category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[
                      md.catChip,
                      {
                        backgroundColor: sel ? m.color + "20" : colors.background,
                        borderColor: sel ? m.color : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Ionicons name={m.icon as any} size={13} color={sel ? m.color : colors.mutedForeground} />
                    <Text style={[md.catLabel, { color: sel ? m.color : colors.mutedForeground }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Item description */}
          <View style={{ gap: 4 }}>
            <Text style={[md.label, { color: colors.mutedForeground }]}>Description *</Text>
            <TextInput
              style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={item}
              onChangeText={setItem}
              placeholder={`e.g. ${category === "fertilizer" ? "Anhydrous ammonia" : category === "seed" ? "Pioneer P1197AM" : category === "herbicide" ? "Roundup PowerMax" : "Describe this expense"}`}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Entry mode toggle */}
          <View style={{ gap: 6 }}>
            <Text style={[md.label, { color: colors.mutedForeground }]}>Cost entry method</Text>
            <View style={[md.modeRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {(["perAcre", "total"] as EntryMode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    md.modeBtn,
                    { backgroundColor: mode === m ? "#366441" : "transparent" },
                  ]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[md.modeBtnText, { color: mode === m ? "#fff" : colors.mutedForeground }]}>
                    {m === "perAcre" ? "Per acre" : "Total spend"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {mode === "perAcre" ? (
            <View style={{ gap: 4 }}>
              <Text style={[md.label, { color: colors.mutedForeground }]}>
                Cost per acre · $/acre
                {meta.hint > 0 ? ` (USDA ERS: ~$${meta.hint}/acre)` : ""}
              </Text>
              <TextInput
                style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={costPerAcre}
                onChangeText={setCostPerAcre}
                keyboardType="decimal-pad"
                placeholder={meta.hint > 0 ? `e.g. ${meta.hint}` : "e.g. 50"}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ gap: 4 }}>
                <Text style={[md.label, { color: colors.mutedForeground }]}>Total cost · $</Text>
                <TextInput
                  style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={totalCost}
                  onChangeText={setTotalCost}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 12000"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={[md.label, { color: colors.mutedForeground }]}>
                  Acres applied (optional — uses farm acreage if blank)
                </Text>
                <TextInput
                  style={[md.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  value={acresApplied}
                  onChangeText={setAcresApplied}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 200"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={{ gap: 4 }}>
            <Text style={[md.label, { color: colors.mutedForeground }]}>Notes (optional)</Text>
            <TextInput
              style={[md.input, md.multiline, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Rate, supplier, application date…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Action row */}
          <View style={md.row}>
            <Pressable style={[md.btn, { backgroundColor: colors.border }]} onPress={onClose}>
              <Text style={[md.btnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[md.btn, { backgroundColor: canSave ? "#366441" : colors.border, flex: 1 }]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[md.btnText, { color: canSave ? "#fff" : colors.mutedForeground }]}>
                  {editing ? "Save changes" : "Add expense"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const md = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 44,
    maxHeight: "90%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 10 },
  title: { fontSize: 17, fontFamily: "Outfit_700Bold" },
  label: { fontSize: 11, fontFamily: "Outfit_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
  },
  multiline: { height: 72, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
  },
  catLabel: { fontSize: 11, fontFamily: "Outfit_500Medium" },
  modeRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    padding: 3,
    gap: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  modeBtnText: { fontSize: 13, fontFamily: "Outfit_600SemiBold" },
  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 0.45,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 14, fontFamily: "Outfit_600SemiBold" },
});

// ── Category group row ────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
  farmAcreage,
  colors,
  onEdit,
  onDelete,
}: {
  category: Category;
  items: InputCost[];
  farmAcreage: number | null | undefined;
  colors: ReturnType<typeof useColors>;
  onEdit: (item: InputCost) => void;
  onDelete: (item: InputCost) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = CATEGORY_META[category];
  const subtotal = items.reduce((s, it) => s + (effectiveCostPerAcre(it, farmAcreage) ?? 0), 0);

  return (
    <View style={[cg.group, { borderColor: colors.border }]}>
      <Pressable style={cg.header} onPress={() => setExpanded((v) => !v)}>
        <View style={[cg.iconWrap, { backgroundColor: meta.color + "18" }]}>
          <Ionicons name={meta.icon as any} size={14} color={meta.color} />
        </View>
        <Text style={[cg.catLabel, { color: colors.foreground }]}>{meta.label}</Text>
        <Text style={[cg.count, { color: colors.mutedForeground }]}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Text>
        <Text style={[cg.subtotal, { color: meta.color }]}>
          ${subtotal % 1 === 0 ? subtotal : subtotal.toFixed(2)}/acre
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={13}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded &&
        items.map((it) => {
          const cpa = effectiveCostPerAcre(it, farmAcreage);
          return (
            <View
              key={it.id}
              style={[cg.row, { borderTopColor: colors.border }]}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[cg.itemName, { color: colors.foreground }]}>{it.item}</Text>
                <Text style={[cg.itemSub, { color: colors.mutedForeground }]}>
                  {cpa != null
                    ? `$${cpa % 1 === 0 ? cpa : cpa.toFixed(2)}/acre`
                    : it.totalCost != null
                    ? `$${it.totalCost.toLocaleString()} total`
                    : "—"}
                  {it.totalCost != null && it.acresApplied != null
                    ? ` · ${it.acresApplied} ac`
                    : ""}
                  {it.notes ? ` · ${it.notes}` : ""}
                </Text>
              </View>
              <View style={cg.actions}>
                <Pressable onPress={() => onEdit(it)} hitSlop={8}>
                  <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} />
                </Pressable>
                <Pressable onPress={() => onDelete(it)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color="#C15A3A" />
                </Pressable>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const cg = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { flex: 1, fontSize: 13, fontFamily: "Outfit_600SemiBold" },
  count: { fontSize: 11, fontFamily: "Outfit_400Regular" },
  subtotal: { fontSize: 13, fontFamily: "Outfit_700Bold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  itemName: { fontSize: 13, fontFamily: "Outfit_500Medium" },
  itemSub: { fontSize: 11, fontFamily: "Outfit_400Regular" },
  actions: { flexDirection: "row", gap: 14 },
});

// ── Summary / comparison strip ────────────────────────────────────────────────

function SummaryStrip({
  trackedPerAcre,
  estimatePerAcre,
  totalItems,
  farmAcreage,
  colors,
  onSync,
  syncing,
}: {
  trackedPerAcre: number;
  estimatePerAcre: number | null | undefined;
  totalItems: number;
  farmAcreage: number | null | undefined;
  colors: ReturnType<typeof useColors>;
  onSync: () => void;
  syncing: boolean;
}) {
  const diff =
    estimatePerAcre != null ? trackedPerAcre - estimatePerAcre : null;
  const diffPct =
    diff != null && estimatePerAcre! > 0
      ? Math.round((diff / estimatePerAcre!) * 100)
      : null;
  const significantDiff = Math.abs(diffPct ?? 0) > 5;
  const needsSync = estimatePerAcre == null || Math.abs(diff ?? 0) > 1;

  let statusColor = "#2D9B5A";
  let statusLabel = "On budget";
  if (diff != null) {
    if (diff > 0 && significantDiff) { statusColor = "#D02020"; statusLabel = "Over estimate"; }
    else if (diff < 0 && significantDiff) { statusColor = "#E8A020"; statusLabel = "Under estimate"; }
  }
  if (estimatePerAcre == null) { statusColor = "#366441"; statusLabel = "No estimate set"; }

  const totalFarmCost =
    farmAcreage != null ? Math.round(trackedPerAcre * farmAcreage) : null;

  return (
    <View style={[ss.wrap, { backgroundColor: "#366441" + "0A", borderColor: "#366441" + "25" }]}>
      {/* Totals row */}
      <View style={ss.totalsRow}>
        <View style={ss.col}>
          <Text style={[ss.bigVal, { color: "#366441" }]}>
            ${trackedPerAcre % 1 === 0 ? trackedPerAcre : trackedPerAcre.toFixed(2)}
          </Text>
          <Text style={[ss.bigLbl, { color: "#366441" }]}>tracked /acre</Text>
        </View>
        {estimatePerAcre != null && (
          <>
            <View style={[ss.divLine, { backgroundColor: "#366441" + "30" }]} />
            <View style={ss.col}>
              <Text style={[ss.bigVal, { color: colors.mutedForeground }]}>
                ${estimatePerAcre % 1 === 0 ? estimatePerAcre : estimatePerAcre.toFixed(2)}
              </Text>
              <Text style={[ss.bigLbl, { color: colors.mutedForeground }]}>B/E estimate</Text>
            </View>
          </>
        )}
        {totalFarmCost != null && (
          <>
            <View style={[ss.divLine, { backgroundColor: "#366441" + "30" }]} />
            <View style={ss.col}>
              <Text style={[ss.bigVal, { color: colors.foreground }]}>
                ${totalFarmCost.toLocaleString()}
              </Text>
              <Text style={[ss.bigLbl, { color: colors.mutedForeground }]}>total farm</Text>
            </View>
          </>
        )}
      </View>

      {/* Status + diff pill */}
      <View style={ss.statusRow}>
        <View style={[ss.badge, { backgroundColor: statusColor + "18" }]}>
          <Text style={[ss.badgeText, { color: statusColor }]}>
            {statusLabel}
            {diff != null && significantDiff
              ? ` (${diff > 0 ? "+" : ""}${diffPct}%)`
              : ""}
          </Text>
        </View>
        <Text style={[ss.itemCount, { color: colors.mutedForeground }]}>
          {totalItems} line item{totalItems !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Sync CTA */}
      {needsSync && trackedPerAcre > 0 && (
        <Pressable
          style={[ss.syncBtn, { borderColor: "#366441" + "40" }]}
          onPress={onSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#366441" />
          ) : (
            <>
              <Ionicons name="sync" size={13} color="#366441" />
              <Text style={ss.syncText}>
                {estimatePerAcre == null
                  ? "Set as breakeven estimate"
                  : `Update B/E estimate to $${Math.round(trackedPerAcre)}/acre`}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  totalsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  col: { flex: 1, alignItems: "center", gap: 2 },
  divLine: { width: 1, height: 32 },
  bigVal: { fontSize: 20, fontFamily: "Outfit_700Bold", lineHeight: 24 },
  bigLbl: { fontSize: 9, fontFamily: "Outfit_500Medium" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 12, fontFamily: "Outfit_600SemiBold" },
  itemCount: { fontSize: 11, fontFamily: "Outfit_400Regular" },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: "dashed",
  },
  syncText: { fontSize: 13, fontFamily: "Outfit_600SemiBold", color: "#366441" },
});

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  farmProfileId: number;
  farmAcreage?: number | null;
  estimateCostPerAcre?: number | null;
}

export default function InputCostCard({
  farmProfileId,
  farmAcreage,
  estimateCostPerAcre,
}: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InputCost | null>(null);

  const { data: costs = [], isLoading } = useGetInputCosts(farmProfileId);

  const invalidateCosts = () =>
    queryClient.invalidateQueries({
      queryKey: getGetInputCostsQueryKey(farmProfileId),
    });
  const invalidateProfile = () =>
    queryClient.invalidateQueries({
      queryKey: getGetFarmProfileQueryKey(farmProfileId),
    });

  const { mutate: create, isPending: creating } = useCreateInputCost({
    mutation: {
      onSuccess: () => { invalidateCosts(); setModalOpen(false); },
    },
  });
  const { mutate: update, isPending: updating } = useUpdateInputCost({
    mutation: {
      onSuccess: () => { invalidateCosts(); setModalOpen(false); setEditing(null); },
    },
  });
  const { mutate: deleteCost } = useDeleteInputCost({
    mutation: { onSuccess: invalidateCosts },
  });
  const { mutate: updateProfile, isPending: syncing } = useUpdateFarmProfile({
    mutation: { onSuccess: invalidateProfile },
  });

  function handleSave(data: {
    category: Category;
    item: string;
    costPerAcre: number | null;
    totalCost: number | null;
    acresApplied: number | null;
    notes: string;
  }) {
    const payload = {
      category: data.category,
      item: data.item,
      costPerAcre: data.costPerAcre,
      totalCost: data.totalCost,
      acresApplied: data.acresApplied,
      notes: data.notes || null,
    };
    if (editing) {
      update({ id: farmProfileId, costId: editing.id, data: payload });
    } else {
      create({ id: farmProfileId, data: payload });
    }
  }

  function handleDelete(cost: InputCost) {
    Alert.alert(
      "Delete expense",
      `Remove "${cost.item}" from your input costs?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteCost({ id: farmProfileId, costId: cost.id }),
        },
      ]
    );
  }

  function handleSync() {
    const total = totalTrackedPerAcre(costs, farmAcreage);
    Alert.alert(
      "Sync to breakeven",
      `Update your cost estimate to $${Math.round(total)}/acre? This will update your breakeven analysis.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: () =>
            updateProfile({
              id: farmProfileId,
              data: { costPerAcre: Math.round(total) },
            }),
        },
      ]
    );
  }

  // Group costs by category
  const grouped = CATEGORIES.reduce<Record<string, InputCost[]>>(
    (acc, cat) => {
      const items = costs.filter((c) => c.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {}
  );

  const trackedTotal = totalTrackedPerAcre(costs, farmAcreage);

  if (isLoading) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color="#366441" />
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.iconWrap, { backgroundColor: "#366441" + "18" }]}>
            <Ionicons name="receipt" size={20} color="#366441" />
          </View>
          <View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Input Cost Tracker</Text>
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>
              {costs.length > 0
                ? `${costs.length} expense${costs.length !== 1 ? "s" : ""} · $${trackedTotal % 1 === 0 ? trackedTotal : trackedTotal.toFixed(2)}/acre tracked`
                : "Track field expenses by category"}
            </Text>
          </View>
        </View>
        <Pressable
          style={[s.addBtn, { backgroundColor: "#366441" }]}
          onPress={() => { setEditing(null); setModalOpen(true); }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {costs.length === 0 ? (
        <EmptyState
          colors={colors}
          onAdd={() => { setEditing(null); setModalOpen(true); }}
        />
      ) : (
        <>
          {/* Summary strip */}
          <SummaryStrip
            trackedPerAcre={trackedTotal}
            estimatePerAcre={estimateCostPerAcre}
            totalItems={costs.length}
            farmAcreage={farmAcreage}
            colors={colors}
            onSync={handleSync}
            syncing={syncing}
          />

          {/* Category groups */}
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <View style={{ gap: 8 }}>
            {(Object.entries(grouped) as [Category, InputCost[]][]).map(
              ([cat, items]) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  items={items}
                  farmAcreage={farmAcreage}
                  colors={colors}
                  onEdit={(it) => { setEditing(it); setModalOpen(true); }}
                  onDelete={handleDelete}
                />
              )
            )}
          </View>
        </>
      )}

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={12} color={colors.mutedForeground} />
        <Text style={[s.footerText, { color: colors.mutedForeground }]}>
          USDA ERS national average costs shown as entry hints. Tap "Sync" to
          push your tracked total into the breakeven analysis.
        </Text>
      </View>

      {/* Modal */}
      <CostModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        saving={creating || updating}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
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
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1, fontSize: 10, fontFamily: "Outfit_400Regular", lineHeight: 14 },
});
