"use client";

import { useMemo } from "react";
import { useCanvasStore, Table } from "@/store/useCanvasStore";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type IssueSeverity = "error" | "warning";

interface Issue {
    id: string;
    tableId?: string;
    columnId?: string;
    severity: IssueSeverity;
    message: string;
}

export function IssuesPanel() {
    const { tables, setSelectedTableIds } = useCanvasStore();

    const issues = useMemo(() => {
        const findings: Issue[] = [];
        const tableNames = new Map<string, number>();

        tables.forEach((table) => {
            // 1. Duplicate Table Names
            const lowerName = table.name.toLowerCase();
            tableNames.set(lowerName, (tableNames.get(lowerName) || 0) + 1);

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
    }, [tables]);

    const handleIssueClick = (issue: Issue) => {
        if (issue.tableId) {
            setSelectedTableIds([issue.tableId]);
        }
    };

    const errorCount = issues.filter(i => i.severity === "error").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-lg">Issues</h2>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span>{errorCount} Errors</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>{warningCount} Warnings</span>
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
                                    : "border-amber-500/30 bg-amber-500/5"
                            )}
                        >
                            <div className="flex items-start gap-2">
                                {issue.severity === "error" ? (
                                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
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
