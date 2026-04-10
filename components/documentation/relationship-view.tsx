"use client";

import { useDocumentationStore } from "@/store/useDocumentationStore";
import { ArrowLeftRight, Link as LinkIcon } from "lucide-react";
import { RelationshipDiagram } from "./relationship-diagram";

export const RelationshipDocView = ({ table }: { table: any }) => {
    const { parsedDbml, tables, setSelectedTableId } = useDocumentationStore();
    
    if (!table || !parsedDbml) return null;

    // Traverse the raw AST for all endpoints (refs)
    const raw = parsedDbml.raw;
    let allEndpoints: any[] = [];
    if (raw.endpoints) {
        allEndpoints = raw.endpoints;
    } else if (raw.schemas) {
        raw.schemas.forEach((s: any) => {
            if (s.endpoints) {
                allEndpoints.push(...s.endpoints);
            } else if (s.refs) {
                s.refs.forEach((r: any) => {
                    if (r.endpoints) allEndpoints.push(...r.endpoints);
                });
            }
        });
    }
    
    const relationships = allEndpoints.filter((ep: any) => ep.tableName === table.name) || [];
    
    // Convert endpoints into full references
    const refs = relationships.map((ep: any) => ep.ref).filter(Boolean);
    const uniqueRefs = Array.from(new Set(refs));

    if (uniqueRefs.length === 0) return null;

    return (
        <div className="mt-12 space-y-4 animate-in fade-in duration-300">
            <h2 className="text-xl font-semibold flex items-center">
                <ArrowLeftRight className="w-5 h-5 mr-2" />
                Relationships
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueRefs.map((ref: any, idx: number) => {
                    const ep1 = ref.endpoints[0];
                    const ep2 = ref.endpoints[1];
                    const isIncoming = ep2.tableName === table.name;
                    
                    const otherEp = isIncoming ? ep1 : ep2;
                    const thisEp = isIncoming ? ep2 : ep1;

                    // Use the flat tables list from the store
                    const targetTable = tables.find((t) => t.name === otherEp.tableName);
                    const targetTableId = targetTable?.id ?? null;

                    return (
                        <div key={idx} className="p-4 rounded-lg border border-border bg-sidebar hover:bg-accent/50 transition-colors cursor-pointer group" onClick={() => targetTableId && setSelectedTableId(targetTableId)}>
                            <div className="flex items-center justify-between">
                                <div className="text-sm">
                                    <span className="font-mono font-semibold text-foreground group-hover:text-blue-500 transition-colors">{thisEp.fieldNames[0]}</span>
                                    <span className="text-muted-foreground mx-2">{isIncoming ? '<' : '>'}</span>
                                    <span className="text-muted-foreground">
                                        <span className="font-medium text-foreground">{otherEp.tableName}</span>
                                        <span className="mx-1">.</span>
                                        <span className="font-mono">{otherEp.fieldNames[0]}</span>
                                    </span>
                                </div>
                                <LinkIcon className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Mini-Diagram: Visual relationship graph */}
            <RelationshipDiagram table={table} />
        </div>
    );
};
