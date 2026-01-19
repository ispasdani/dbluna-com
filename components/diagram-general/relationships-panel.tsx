"use client";

import { useCanvasStore, Relationship } from "@/store/useCanvasStore";
import { 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function RelationshipsPanel() {
  const {
    relationships,
    tables,
    updateRelationship,
    deleteRelationship,
  } = useCanvasStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div>
           <h3 className="font-medium text-foreground">Relationships</h3>
           <p className="text-xs text-muted-foreground">
             {relationships.length} connections
           </p>
        </div>
      </div>

      {/* Relationships List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {relationships.map((rel) => {
           const isExpanded = rel.id === expandedId;
           const sourceTable = tables.find(t => t.id === rel.sourceTableId);
           const targetTable = tables.find(t => t.id === rel.targetTableId);
           const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumnId);
           const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumnId);

           const displayName = rel.name || `${sourceTable?.name}.${sourceColumn?.name} -> ${targetTable?.name}.${targetColumn?.name}`;

           return (
             <div 
               key={rel.id} 
               className={cn(
                 "border rounded-md transition-all duration-200",
                 isExpanded ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"
               )}
             >
               {/* Header Row */}
               <div 
                 className="flex items-center p-2 cursor-pointer select-none"
                 onClick={() => toggleExpand(rel.id)}
               >
                 {isExpanded ? (
                   <ChevronDown className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                 ) : (
                   <ChevronRight className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                 )}
                 
                 <LinkIcon className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
                 <span className="font-medium text-sm truncate flex-1">{displayName}</span>
                 
                 {isExpanded && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10 -mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRelationship(rel.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                 )}
               </div>

               {/* Expanded Details */}
               {isExpanded && (
                 <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 fade-in duration-200 space-y-3">
                    {/* Name */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <Input 
                        value={rel.name || ""} 
                        onChange={(e) => updateRelationship(rel.id, { name: e.target.value })}
                        placeholder="Relationship name"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Cardinality */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Cardinality</label>
                      <select
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={rel.cardinality || "One to many"}
                        onChange={(e) => updateRelationship(rel.id, { cardinality: e.target.value as any })}
                      >
                        <option value="One to one">One to one</option>
                        <option value="One to many">One to many</option>
                        <option value="Many to one">Many to one</option>
                      </select>
                    </div>

                     {/* On Update */}
                     <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">On Update</label>
                      <select
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={rel.onUpdate || "No action"}
                        onChange={(e) => updateRelationship(rel.id, { onUpdate: e.target.value as any })}
                      >
                        <option value="No action">No action</option>
                        <option value="Restrict">Restrict</option>
                        <option value="Cascade">Cascade</option>
                        <option value="Set null">Set null</option>
                        <option value="Set default">Set default</option>
                      </select>
                    </div>

                    {/* On Delete */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">On Delete</label>
                      <select
                        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={rel.onDelete || "No action"}
                        onChange={(e) => updateRelationship(rel.id, { onDelete: e.target.value as any })}
                      >
                         <option value="No action">No action</option>
                        <option value="Restrict">Restrict</option>
                        <option value="Cascade">Cascade</option>
                        <option value="Set null">Set null</option>
                        <option value="Set default">Set default</option>
                      </select>
                    </div>
                    
                    {/* Read-only info about tables */}
                    <div className="pt-2 text-xs text-muted-foreground border-t">
                      <div className="flex justify-between">
                         <span>Primary:</span>
                         <span className="font-medium text-foreground">{sourceTable?.name}.{sourceColumn?.name}</span>
                      </div>
                      <div className="flex justify-between">
                         <span>Foreign:</span>
                         <span className="font-medium text-foreground">{targetTable?.name}.{targetColumn?.name}</span>
                      </div>
                    </div>
                 </div>
               )}
             </div>
           );
        })}
        {relationships.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
             No relationships yet. Connect tables on the canvas.
          </div>
        )}
      </div>
    </div>
  );
}
