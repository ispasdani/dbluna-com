"use client";

import styles from "./docs.module.scss";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { ArrowLeftRight, Link as LinkIcon } from "lucide-react";
import type { ParsedRefEndpoint, ParsedTable } from "@/lib/parser/dsl-parser";
import { RelationshipDiagram } from "./relationship-diagram";

function matches(table: ParsedTable, endpoint: ParsedRefEndpoint) {
  return table.name === endpoint.tableName &&
    (table.schema?.name ?? "public") === (endpoint.schemaName ?? "public");
}

export const RelationshipDocView = ({ table }: { table: ParsedTable }) => {
  const { parsedDbml, tables, setSelectedTableId } = useDocumentationStore();
  const refs = parsedDbml?.refs.filter((ref) =>
    ref.endpoints.some((endpoint) => matches(table, endpoint)),
  ) ?? [];

  if (!refs.length) return null;

  return (
    <div className="mt-12 space-y-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-semibold flex items-center">
        <ArrowLeftRight className="w-5 h-5 mr-2" />
        Relationships
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {refs.map((ref, index) => {
          const [source, target] = ref.endpoints;
          const outgoing = matches(table, source);
          const local = outgoing ? source : target;
          const remote = outgoing ? target : source;
          const otherTable = tables.find((item) => matches(item, remote));
          const remoteName = remote.schemaName && remote.schemaName !== "public"
            ? [remote.schemaName, remote.tableName].join(".")
            : remote.tableName;

          return (
            <button
              key={index}
              type="button"
              disabled={!otherTable}
              className={`${styles.linkCard} group`}
              onClick={() => otherTable && setSelectedTableId(otherTable.id)}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono">
                  {local.fieldNames.join(", ")} {outgoing ? "→" : "←"} {remoteName} ({remote.fieldNames.join(", ")})
                </span>
                <LinkIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {outgoing ? "Outgoing" : "Incoming"} · Update {ref.onUpdate ?? "no action"} · Delete {ref.onDelete ?? "no action"}
              </div>
            </button>
          );
        })}
      </div>
      <RelationshipDiagram table={table} />
    </div>
  );
};
