"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConnectionStore } from "@/store/connection";
import { useCanvasStore, Table as CanvasTable, Relationship, TABLE_COLORS } from "@/store/useCanvasStore";
import dagre from "@dagrejs/dagre";

interface ErdDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ErdGenerationDialog({ open, onOpenChange }: ErdDialogProps) {
    const connectionConfig = useConnectionStore(state => state.connectionConfig);
    const [databases, setDatabases] = useState<any[]>([]);
    const [selectedDb, setSelectedDb] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && typeof window !== "undefined" && (window as any).electron) {
            const fetchDbs = async () => {
                try {
                    const res = await (window as any).electron.getDatabases();
                    if (res?.success) setDatabases(res.data);
                } catch (e) {
                    console.error("Failed to list databases", e);
                }
            };
            fetchDbs();
        }
    }, [open, connectionConfig]);

    const handleGenerate = async () => {
        if (!selectedDb) return;
        setIsLoading(true);
        try {
            const res = await (window as any).electron.getERDData(selectedDb);
            if (res?.success) {
                const { columns, relationships } = res.data;
                // Build tables
                const tableMap = new Map<string, CanvasTable>();
                
                // Group columns by table
                for (const col of columns) {
                    const fullName = `[${col.schema_name}].[${col.table_name}]`;
                    if (!tableMap.has(fullName)) {
                        tableMap.set(fullName, {
                            id: fullName, // using full name as id for easy fk linking
                            name: fullName,
                            x: 0,
                            y: 0,
                            color: TABLE_COLORS[Math.floor(Math.random() * TABLE_COLORS.length)],
                            columns: []
                        });
                    }
                    const tbl = tableMap.get(fullName)!;
                    tbl.columns.push({
                        id: `${fullName}-${col.column_name}`,
                        name: col.column_name,
                        type: col.data_type,
                        isPrimaryKey: col.is_pk === true,
                        isNotNull: col.is_nullable === false,
                        isUnique: false, // Not queried
                        isAutoIncrement: col.is_auto_increment === true
                    });
                }
                
                const canvasTables = Array.from(tableMap.values());
                const canvasRelationships: Relationship[] = [];
                
                const g = new dagre.graphlib.Graph();
                g.setGraph({ rankdir: "LR", ranksep: 200, nodesep: 100 });
                g.setDefaultEdgeLabel(() => ({}));
                
                const nodeWidth = 240;
                
                for (const t of canvasTables) {
                    const nodeHeight = 40 + (t.columns.length * 26);
                    g.setNode(t.id, { width: nodeWidth, height: nodeHeight });
                }
                
                for (const rel of relationships) {
                    // We treat the "source_table" coming from SQL exactly how dagre wants it:
                    // SQL returns the Parent Table as the one containing the foreign key (Many side).
                    // SQL Referenced Table is the Target Table (One side).
                    // In ERD terms, relationships generally draw from Many -> One. Dagre uses edges to determine gravity.
                    const sourceId = `[${rel.source_schema}].[${rel.source_table}]`;
                    const targetId = `[${rel.target_schema}].[${rel.target_table}]`;
                    const sourceColId = `${sourceId}-${rel.source_column}`;
                    const targetColId = `${targetId}-${rel.target_column}`;
                    
                    if (tableMap.has(sourceId) && tableMap.has(targetId)) {
                        g.setEdge(sourceId, targetId);
                        canvasRelationships.push({
                            id: rel.fk_name,
                            name: rel.fk_name,
                            sourceTableId: sourceId,
                            sourceColumnId: sourceColId,
                            targetTableId: targetId,
                            targetColumnId: targetColId,
                            cardinality: "One to many", // Generally Many-to-One from Child to Parent
                            onUpdate: "No action",
                            onDelete: "No action"
                        });
                    }
                }
                
                dagre.layout(g);
                
                // Map laid out coords back to tables
                const positionedTables = canvasTables.map(t => {
                   const node = g.node(t.id);
                   return { ...t, x: node.x - nodeWidth / 2, y: node.y - node.height / 2 }; 
                });
                
                // Save to canvas store
                useCanvasStore.setState({ tables: positionedTables, relationships: canvasRelationships });
                onOpenChange(false);
            }
        } catch (e) {
            console.error("Failed to layout ERD", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generate Diagram</DialogTitle>
                    <DialogDescription>
                        Select a database to automatically layout an Entity-Relationship Diagram based on its active tables and foreign keys.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {!connectionConfig ? (
                        <p className="text-sm text-red-500">Not connected to any Sql Server. Please connect via Object Explorer first.</p>
                    ) : (
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Database</label>
                            <Select value={selectedDb} onValueChange={setSelectedDb}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Database" />
                                </SelectTrigger>
                                <SelectContent>
                                    {databases.map(db => (
                                        <SelectItem key={db.name} value={db.name}>{db.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!selectedDb || isLoading} onClick={handleGenerate}>
                        {isLoading ? "Generating..." : "Generate ERD"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
