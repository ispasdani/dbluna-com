"use client";

import { useCanvasStore, Table, Relationship } from "@/store/useCanvasStore";
import { useEditorStore } from "@/store/useEditorStore";
import { TEMPLATES, Template } from "@/constants/templates";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function TemplatesPanel() {
    const { setTables, addRelationship, tables: existingTables, relationships: existingRelationships } = useCanvasStore();
    const { viewport, camera } = useEditorStore();

    const handleApplyTemplate = (template: Template) => {
        // 1. Generate new IDs map to avoid collisions if template is applied multiple times
        const idMap = new Map<string, string>();

        // Map Table IDs
        template.tables.forEach(t => {
            idMap.set(t.id, crypto.randomUUID());
            t.columns.forEach(c => {
                idMap.set(c.id, crypto.randomUUID());
            });
        });

        // Calculate center of viewport
        const viewCenterX = viewport.w / 2;
        const viewCenterY = viewport.h / 2;
        const worldCenterX = (viewCenterX - camera.x) / camera.zoom;
        const worldCenterY = (viewCenterY - camera.y) / camera.zoom;

        // 2. Clone and Prepare Tables
        const newTables: Table[] = template.tables.map(t => ({
            ...t,
            id: idMap.get(t.id)!,
            // Position relative to center
            x: worldCenterX + t.x - 450, // Roughly center the 900px wide layout
            y: worldCenterY + t.y - 350, // Roughly center the 700px high layout
            columns: t.columns.map(c => ({
                ...c,
                id: idMap.get(c.id)!
            }))
        }));

        // 3. Clone and Prepare Relationships
        const newRelationships: Relationship[] = template.relationships.map(r => ({
            ...r,
            id: crypto.randomUUID(),
            sourceTableId: idMap.get(r.sourceTableId)!,
            sourceColumnId: idMap.get(r.sourceColumnId)!,
            targetTableId: idMap.get(r.targetTableId)!,
            targetColumnId: idMap.get(r.targetColumnId)!
        }));

        // 4. Update Store
        // Append new tables to existing ones
        setTables([...existingTables, ...newTables]);

        // Add each relationship
        newRelationships.forEach(rel => {
            addRelationship(rel);
        });

        // Toast removed as library not available
        // toast.success(`Added ${template.name} template with ${newTables.length} tables.`);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b shrink-0">
                <h3 className="font-medium text-foreground">Templates</h3>
                <p className="text-xs text-muted-foreground">
                    Start with a pre-built schema
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {TEMPLATES.map((template) => (
                    <div
                        key={template.id}
                        className="border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors"
                    >
                        <div>
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                {template.name}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                                {template.description}
                            </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground">{template.tables.length}</span> Tables
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground">{template.relationships.length}</span> Relations
                            </div>
                        </div>

                        <Button
                            className="w-full gap-2"
                            size="sm"
                            onClick={() => handleApplyTemplate(template)}
                        >
                            <Plus className="w-4 h-4" />
                            Add to Canvas
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
