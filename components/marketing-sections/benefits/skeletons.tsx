import { KeyRound, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABLE_COLORS: Record<string, string> = {
  users: "#6366f1",
  orders: "#f59e0b",
};

const COLUMNS: Record<string, { name: string; type: string; kind?: "pk" | "fk" }[]> = {
  users: [
    { name: "id", type: "int", kind: "pk" },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
  ],
  orders: [
    { name: "id", type: "int", kind: "pk" },
    { name: "user_id", type: "int", kind: "fk" },
    { name: "total", type: "numeric" },
  ],
};

/**
 * A small canvas table card, drawn like the editor's Recommended style: colour
 * square and name, then key / link icons with types on the right.
 */
export const MiniTable = ({ label, className }: { label: string; className?: string }) => {
  const color = TABLE_COLORS[label] ?? "#6366f1";
  const cols = COLUMNS[label] ?? COLUMNS.users;
  return (
    <div
      className={cn(
        "flex w-26 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_1.5px_rgb(0_0_0/0.06),0_6px_16px_rgb(0_0_0/0.08)] dark:border-neutral-700 dark:bg-neutral-900",
        className
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-2 py-1.5 text-[9.5px] font-semibold text-charcoal-700 dark:border-neutral-700 dark:text-neutral-100">
        <span className="size-2 shrink-0 rounded-[2.5px]" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex flex-col px-0.5 py-0.5">
        {cols.map((c) => (
          <div key={c.name} className="flex items-center gap-1 px-1.5 py-[3px] text-[8.5px]">
            <span className="grid w-2 shrink-0 place-items-center">
              {c.kind === "pk" && <KeyRound className="size-2" style={{ color }} />}
              {c.kind === "fk" && <Link2 className="size-2 text-gray-400 dark:text-neutral-500" />}
            </span>
            <span className={cn("truncate text-charcoal-700 dark:text-neutral-200", c.kind === "pk" && "font-semibold")}>
              {c.name}
            </span>
            <span className="ml-auto shrink-0 text-gray-400 dark:text-neutral-500">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
