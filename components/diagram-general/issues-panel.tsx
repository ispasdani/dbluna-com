"use client";

import { useMemo } from "react";
import { useCanvasStore, Table } from "@/store/useCanvasStore";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type IssueSeverity = "error" | "warning" | "info";

interface Issue {
    id: string;
    tableId?: string;
    columnId?: string;
    severity: IssueSeverity;
    message: string;
}

const SQL_RESERVED_KEYWORDS = new Set([
    "select", "from", "where", "insert", "update", "delete", "create", "drop", "alter", "table", "index",
    "view", "order", "group", "by", "having", "limit", "offset", "join", "inner", "left", "right", "full",
    "outer", "on", "as", "distinct", "union", "all", "and", "or", "not", "null", "is", "in", "between",
    "like", "exists", "count", "sum", "avg", "min", "max", "primary", "key", "foreign", "references",
    "default", "constraint", "unique", "check", "values", "into", "set", "add", "column", "database",
    "user", "password", "grant", "revoke", "transaction", "commit", "rollback"
]);

export function IssuesPanel() {
    const { tables, relationships, setSelectedTableIds } = useCanvasStore();

    const issues = useMemo(() => {
        const findings: Issue[] = [];
        const tableNames = new Map<string, number>();
        const connectedTableIds = new Set<string>();

        // Analyze Relationships for connectivity and type mismatches
        relationships.forEach(rel => {
            connectedTableIds.add(rel.sourceTableId);
            connectedTableIds.add(rel.targetTableId);

            const sourceTable = tables.find(t => t.id === rel.sourceTableId);
            const targetTable = tables.find(t => t.id === rel.targetTableId);

            if (sourceTable && targetTable) {
                const sourceCol = sourceTable.columns.find(c => c.id === rel.sourceColumnId);
                const targetCol = targetTable.columns.find(c => c.id === rel.targetColumnId);

                // 6. FK Type Mismatch
                if (sourceCol && targetCol && sourceCol.type !== targetCol.type) {
                    findings.push({
                        id: `fk-mismatch-${rel.id}`,
                        tableId: sourceTable.id,
                        severity: "warning",
                        message: `Type mismatch in relationship: '${sourceTable.name}.${sourceCol.name}' (${sourceCol.type}) vs '${targetTable.name}.${targetCol.name}' (${targetCol.type}).`
                    });
                }
            }
        });

        tables.forEach((table) => {
            // 1. Duplicate Table Names
            const lowerName = table.name.toLowerCase();
            tableNames.set(lowerName, (tableNames.get(lowerName) || 0) + 1);

            // 7. Reserved Keywords in Table Name
            if (SQL_RESERVED_KEYWORDS.has(lowerName)) {
                findings.push({
                    id: `reserved-table-${table.id}`,
                    tableId: table.id,
                    severity: "warning",
                    message: `Table name '${table.name}' is a reserved SQL keyword.`
                });
            }

            // 8. Orphaned Tables
            if (!connectedTableIds.has(table.id) && tables.length > 1) {
                findings.push({
                    id: `orphaned-${table.id}`,
                    tableId: table.id,
                    severity: "info",
                    message: `Table '${table.name}' is not connected to any other table.`
                });
            }

            // 2. Initial Checks per table
            if (table.columns.length === 0) {
                findings.push({
                    id: `empty-${table.id}`,
                    tableId: table.id,
                    severity: "warning",
                    message: `Table '${table.name}' has no columns.`
                });
            }

            let hasPrimaryKey = false;
            const columnNames = new Set<string>();

            table.columns.forEach((col) => {
                if (col.isPrimaryKey) hasPrimaryKey = true;

                // 3. Missing Column Type
                if (!col.type) {
                    findings.push({
                        id: `no-type-${table.id}-${col.id}`,
                        tableId: table.id,
                        columnId: col.id,
                        severity: "error",
                        message: `Column '${col.name}' in '${table.name}' has no type.`
                    });
                }

                // 4. Duplicate Column Names in Table
                if (columnNames.has(col.name)) {
                    findings.push({
                        id: `dup-col-${table.id}-${col.name}`,
                        tableId: table.id,
                        columnId: col.id,
                        severity: "error",
                        message: `Duplicate column '${col.name}' in table '${table.name}'.`
                    });
                }
                columnNames.add(col.name);

                // 7. Reserved Keywords in Column Name
                if (SQL_RESERVED_KEYWORDS.has(col.name.toLowerCase())) {
                    findings.push({
                        id: `reserved-col-${table.id}-${col.id}`,
                        tableId: table.id,
                        columnId: col.id,
                        severity: "warning",
                        message: `Column '${col.name}' in '${table.name}' is a reserved SQL keyword.`
                    });
                }
            });

            // 5. Missing Primary Key
            if (!hasPrimaryKey && table.columns.length > 0) {
                findings.push({
                    id: `no-pk-${table.id}`,
                    tableId: table.id,
                    severity: "warning",
                    message: `Table '${table.name}' has no primary key.`
                });
            }
        });

        // Check duplicate table names
        tables.forEach((table) => {
            if ((tableNames.get(table.name.toLowerCase()) || 0) > 1) {
                findings.push({
                    id: `dup-table-${table.id}`,
                    tableId: table.id,
                    severity: "error",
                    message: `Duplicate table name '${table.name}'.`
                });
            }
        });

        return findings;
    }, [tables, relationships]);

    const handleIssueClick = (issue: Issue) => {
        if (issue.tableId) {
            setSelectedTableIds([issue.tableId]);
        }
    };

    const errorCount = issues.filter(i => i.severity === "error").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;
    const infoCount = issues.filter(i => i.severity === "info").length;

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-lg">Issues</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span>{errorCount} Errors</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>{warningCount} Warnings</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-blue-500" />
                        <span>{infoCount} Info</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-green-500/50" />
                        <p>No issues found. Great job!</p>
                    </div>
                ) : (
                    issues.map((issue) => (
                        <button
                            key={issue.id}
                            onClick={() => handleIssueClick(issue)}
                            className={cn(
                                "w-full text-left p-3 rounded-md border text-sm transition-colors hover:bg-accent/50",
                                issue.severity === "error"
                                    ? "border-destructive/30 bg-destructive/5"
                                    : issue.severity === "warning"
                                        ? "border-amber-500/30 bg-amber-500/5"
                                        : "border-blue-500/30 bg-blue-500/5"
                            )}
                        >
                            <div className="flex items-start gap-2">
                                {issue.severity === "error" ? (
                                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                ) : issue.severity === "warning" ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                ) : (
                                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                )}
                                <span className="text-foreground/90">{issue.message}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
