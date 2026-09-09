"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ListOrdered,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useCanvasStore,
  type CanvasEnum,
  type EnumValue,
} from "@/store/useCanvasStore";
import {
  buildEnumUsageIndex,
  tablesStructureSignature,
  type EnumUsageSite,
} from "@/lib/enum-usage";
import { CommittedInput } from "./committed-input";
import { useDockStore } from "@/store/useDockStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Unique-ifies a proposed name against the existing ones. */
function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

// ─── EnumValueRow ─────────────────────────────────────────────────────────────

function EnumValueRow({
  value,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  value: EnumValue;
  index: number;
  total: number;
  onChange: (patch: Partial<EnumValue>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-card border border-border p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <CommittedInput
          value={value.name}
          onCommit={(name) => onChange({ name })}
          placeholder="value"
          aria-label={`Enum value ${index + 1} name`}
          className="h-7 text-xs font-mono"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove value"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <CommittedInput
        value={value.note ?? ""}
        onCommit={(note) => onChange({ note: note.trim() || undefined })}
        placeholder="Note (optional)"
        aria-label={`Enum value ${index + 1} note`}
        className="h-7 text-xs"
      />
    </div>
  );
}

// ─── EnumCard ─────────────────────────────────────────────────────────────────

function EnumCard({
  canvasEnum,
  usage,
  isExpanded,
  onToggle,
  onPatch,
  onPatchValues,
  onDelete,
  onSelectTable,
}: {
  canvasEnum: CanvasEnum;
  usage: EnumUsageSite[];
  isExpanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<CanvasEnum>) => void;
  onPatchValues: (updater: (prev: EnumValue[]) => EnumValue[]) => void;
  onDelete: () => void;
  onSelectTable: (tableId: string) => void;
}) {
  return (
    <div className="border border-border">
      <div className="flex items-center p-2 gap-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-left select-none"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-mono text-sm truncate" title={canvasEnum.name}>
            {canvasEnum.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {canvasEnum.values.length} value{canvasEnum.values.length === 1 ? "" : "s"}
          </span>
        </button>

        <span
          className={
            usage.length > 0
              ? "text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0"
              : "text-[11px] text-muted-foreground shrink-0"
          }
        >
          {usage.length > 0
            ? `${usage.length} use${usage.length === 1 ? "" : "s"}`
            : "unused"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground/60 hover:text-destructive"
          onClick={onDelete}
          title="Delete enum"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <CommittedInput
              value={canvasEnum.name}
              onCommit={(name) => onPatch({ name })}
              placeholder="enum_name"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <CommittedInput
              value={canvasEnum.note ?? ""}
              onCommit={(note) => onPatch({ note: note.trim() || undefined })}
              placeholder="Optional description"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Values</label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1 px-2"
                onClick={() =>
                  onPatchValues((prev) => [
                    ...prev,
                    { name: uniqueName("value", prev.map((v) => v.name)) },
                  ])
                }
              >
                <Plus className="w-3 h-3" /> Value
              </Button>
            </div>

            {canvasEnum.values.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No values yet. An enum with no values is dropped from the generated DBML.
              </p>
            ) : (
              <div className="space-y-2">
                {canvasEnum.values.map((value, idx) => (
                  <EnumValueRow
                    key={idx}
                    value={value}
                    index={idx}
                    total={canvasEnum.values.length}
                    onChange={(patch) =>
                      onPatchValues((prev) =>
                        prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
                      )
                    }
                    onMove={(delta) =>
                      onPatchValues((prev) => {
                        const next = [...prev];
                        const target = idx + delta;
                        if (target < 0 || target >= next.length) return prev;
                        [next[idx], next[target]] = [next[target], next[idx]];
                        return next;
                      })
                    }
                    onRemove={() => onPatchValues((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            )}
          </div>

          {usage.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Used by</label>
              <div className="flex flex-wrap gap-1">
                {usage.map((site) => (
                  <button
                    key={site.columnId}
                    type="button"
                    onClick={() => onSelectTable(site.tableId)}
                    className="text-[11px] font-mono px-1.5 py-0.5 border border-border hover:bg-accent transition-colors"
                    title={`Select ${site.tableName}`}
                  >
                    {site.tableName}.{site.columnName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EnumsPanel ───────────────────────────────────────────────────────────────

export function EnumsPanel() {
  const enums = useCanvasStore((s) => s.enums);
  const tables = useCanvasStore((s) => s.tables);
  const setSelectedTableIds = useCanvasStore((s) => s.setSelectedTableIds);
  const openTab = useDockStore((s) => s.openTab);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CanvasEnum | null>(null);

  // `tables` is replaced on every pointermove of a canvas drag. Keying the
  // usage scan on a structural fingerprint instead of the array identity keeps
  // it off the drag path entirely.
  const signature = useMemo(() => tablesStructureSignature(tables), [tables]);
  const usageIndex = useMemo(
    () => buildEnumUsageIndex(tables, enums),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, enums]
  );

  // Every mutation reads `enums` fresh from the store rather than from the
  // render closure. A field committing on blur writes the store during the
  // mousedown that precedes a button's click, so a closure captured at render
  // time can already be one edit stale by the time the click handler runs.
  const mutate = (next: (current: CanvasEnum[]) => CanvasEnum[]) => {
    const store = useCanvasStore.getState();
    store.setEnums(next(store.enums));
  };

  const patchEnum = (id: string, patch: Partial<CanvasEnum>) =>
    mutate((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const patchEnumValues = (id: string, updater: (prev: EnumValue[]) => EnumValue[]) =>
    mutate((current) =>
      current.map((e) => (e.id === id ? { ...e, values: updater(e.values) } : e))
    );

  const addEnum = () => {
    const created: CanvasEnum = {
      id: crypto.randomUUID(),
      name: uniqueName("new_enum", useCanvasStore.getState().enums.map((e) => e.name)),
      values: [{ name: "value" }],
    };
    mutate((current) => [...current, created]);
    setExpandedId(created.id);
  };

  const requestDelete = (target: CanvasEnum) => {
    if ((usageIndex.get(target.id) ?? []).length === 0) {
      mutate((current) => current.filter((e) => e.id !== target.id));
      return;
    }
    setPendingDelete(target);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    mutate((current) => current.filter((e) => e.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const pendingUsage = pendingDelete ? (usageIndex.get(pendingDelete.id) ?? []) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Enums</h2>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={addEnum}>
            <Plus className="w-3 h-3" /> New enum
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Named value sets usable as column types. Pick an enum from the type selector in the{" "}
          <button
            type="button"
            onClick={() => openTab("tables")}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Tables tab
          </button>
          .
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {enums.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No enums yet. Click <strong>New enum</strong> above to create one, then assign it
            as a column type in the Tables tab.
          </p>
        ) : (
          enums.map((e) => (
            <EnumCard
              key={e.id}
              canvasEnum={e}
              usage={usageIndex.get(e.id) ?? []}
              isExpanded={expandedId === e.id}
              onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
              onPatch={(patch) => patchEnum(e.id, patch)}
              onPatchValues={(updater) => patchEnumValues(e.id, updater)}
              onDelete={() => requestDelete(e)}
              onSelectTable={(tableId) => setSelectedTableIds([tableId])}
            />
          ))
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete enum &ldquo;{pendingDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {pendingUsage.length} column
                  {pendingUsage.length === 1 ? "" : "s"} still use this type. Their types are
                  left unchanged, so they will refer to an enum that no longer exists.
                </p>
                <ul className="font-mono text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {pendingUsage.map((site) => (
                    <li key={site.columnId}>
                      {site.tableName}.{site.columnName}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete enum</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
