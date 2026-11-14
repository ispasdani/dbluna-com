"use client";

import { flushSync } from "react-dom";
import { docsItemId, findDocsTable } from "@/lib/docs-search";
import { qualifySqlServerTable } from "@/lib/schema-namespace";
import type { SqlServerObject } from "@/store/useCanvasStore";
import { useDocumentationStore } from "@/store/useDocumentationStore";

function objectName(object: SqlServerObject) {
  return object.schema ? qualifySqlServerTable(object.schema, object.name) : object.name;
}

export function ObjectDependencies({ object }: { object: SqlServerObject }) {
  const { tables, project, setSelectedTableId } = useDocumentationStore();
  const objects = project?.sqlServerObjects ?? [];
  const incoming = objects.filter(item => item.dependencies.includes(objectName(object)));
  const openObject = (target: SqlServerObject) => {
    const owner = { name: target.name, schema: target.schema ? { name: target.schema } : undefined };
    flushSync(() => setSelectedTableId(null));
    document.getElementById(docsItemId(owner, target.kind ?? "View", target.name))?.focus();
  };

  return (
    <>
      {!!object.dependencies.length && (
        <div className="text-sm">
          <h4 className="font-medium">Dependencies</h4>
          <ul className="space-y-1">
            {object.dependencies.map(name => {
              const table = findDocsTable(tables, name) ?? tables.find(item =>
                objectName({ name: item.name, schema: item.schema?.name, dependencies: [] }) === name,
              );
              const target = objects.find(item => objectName(item) === name);
              return (
                <li key={name}>
                  {table || target ? (
                    <button type="button" className="font-mono text-primary underline"
                      onClick={() => table ? setSelectedTableId(table.id) : target && openObject(target)}>
                      {name}
                    </button>
                  ) : <code>{name}</code>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!!incoming.length && (
        <div className="text-sm">
          <h4 className="font-medium">Referenced by</h4>
          <ul className="space-y-1">
            {incoming.map(item => (
              <li key={JSON.stringify([item.kind, item.schema, item.name])}>
                <button type="button" className="font-mono text-primary underline" onClick={() => openObject(item)}>
                  {objectName(item)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
