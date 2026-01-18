"use client";

import { useCanvasStore } from "@/store/useCanvasStore";
import { 
  Plus, 
  Trash2, 
  Key, 
  MoreVertical, 
  ChevronRight, 
  ChevronDown,
  Fingerprint,
  Ban,
  ArrowUp10
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
// import { ScrollArea } from "@/components/ui/scroll-area"; // Removed as file not found
// If ScrollArea doesn't exist, I'll use div with overflow-auto. I didn't see scroll-area.tsx in components/ui list (Step 48).
// So I will use standard div.

export function TablesPanel() {
  const {
    tables,
    selectedTableId,
    addTable,
    updateTable,
    deleteTable,
    setSelectedTableId,
    addField,
    updateField,
    deleteField,
  } = useCanvasStore();

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div>
           <h3 className="font-medium text-foreground">Tables</h3>
           <p className="text-xs text-muted-foreground">
             {tables.length} tables in schema
           </p>
        </div>
        <Button onClick={addTable} size="sm" className="h-8 gap-1">
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {tables.map((table) => {
           const isSelected = table.id === selectedTableId;

           return (
             <div 
               key={table.id} 
               className={cn(
                 "border rounded-md transition-all duration-200",
                 isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"
               )}
             >
               {/* Table Header Row */}
               <div 
                 className="flex items-center p-2 cursor-pointer select-none"
                 onClick={() => setSelectedTableId(isSelected ? null : table.id)}
               >
                 {isSelected ? (
                   <ChevronDown className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                 ) : (
                   <ChevronRight className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                 )}
                 
                 <div className="h-3 w-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: table.color }} />
                 <span className="font-medium text-sm truncate flex-1">{table.name}</span>
                 
                 {isSelected && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10 -mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTable(table.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                 )}
               </div>

               {/* Expanded Details */}
               {isSelected && (
                 <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="mb-3 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Table Name</label>
                      <Input 
                        value={table.name} 
                        onChange={(e) => updateTable(table.id, { name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-xs font-medium text-muted-foreground">Columns</label>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-6 text-xs gap-1 px-2"
                           onClick={() => addField(table.id)}
                         >
                           <Plus className="w-3 h-3" /> Field
                         </Button>
                       </div>

                       <div className="space-y-2">
                          {table.columns.map((col, idx) => (
                             <div key={col.id} className="bg-card border rounded p-2 text-sm flex flex-col gap-2 relative group">
                                <div className="flex items-center gap-2">
                                   <Input 
                                      value={col.name}
                                      onChange={(e) => updateField(table.id, col.id, { name: e.target.value })}
                                      className="h-7 px-2 text-xs flex-1"
                                      placeholder="Column name"
                                   />
                                   <div className="w-[80px]">
                                      <select
                                        className="h-7 w-full rounded border bg-background px-2 py-0 text-xs focus:ring-1 focus:ring-primary"
                                        value={col.type}
                                        onChange={(e) => updateField(table.id, col.id, { type: e.target.value })}
                                      >
                                        <option value="INT">INT</option>
                                        <option value="VARCHAR">VARCHAR</option>
                                        <option value="TEXT">TEXT</option>
                                        <option value="BOOLEAN">BOOL</option>
                                        <option value="TIMESTAMP">TIME</option>
                                        <option value="DATE">DATE</option>
                                        <option value="FLOAT">FLOAT</option>
                                        <option value="UUID">UUID</option>
                                        <option value="JSON">JSON</option>
                                      </select>
                                   </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => deleteField(table.id, col.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                                
                                {/* Constraints Row */}
                                <div className="flex items-center gap-1">
                                   <ConstraintToggle 
                                      active={col.isPrimaryKey} 
                                      onClick={() => updateField(table.id, col.id, { isPrimaryKey: !col.isPrimaryKey })}
                                      icon={Key}
                                      label="PK"
                                      activeColor="text-yellow-500 bg-yellow-500/10 border-yellow-500/20"
                                   />
                                   <ConstraintToggle 
                                      active={col.isNotNull} 
                                      onClick={() => updateField(table.id, col.id, { isNotNull: !col.isNotNull })}
                                      icon={Ban}
                                      label="NN"
                                      activeColor="text-purple-500 bg-purple-500/10 border-purple-500/20"
                                   />
                                   <ConstraintToggle 
                                      active={col.isUnique} 
                                      onClick={() => updateField(table.id, col.id, { isUnique: !col.isUnique })}
                                      icon={Fingerprint}
                                      label="UQ"
                                      activeColor="text-blue-500 bg-blue-500/10 border-blue-500/20"
                                   />
                                   <ConstraintToggle 
                                      active={col.isAutoIncrement} 
                                      onClick={() => updateField(table.id, col.id, { isAutoIncrement: !col.isAutoIncrement })}
                                      icon={ArrowUp10}
                                      label="AI"
                                      activeColor="text-green-500 bg-green-500/10 border-green-500/20"
                                   />
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}
             </div>
           );
        })}
        {tables.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
             No tables yet. Click "Add" to start.
          </div>
        )}
      </div>
    </div>
  );
}

function ConstraintToggle({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  activeColor 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 h-6 rounded border text-[10px] font-medium transition-colors",
        active 
          ? activeColor || "bg-primary/10 text-primary border-primary/20" 
          : "bg-background text-muted-foreground border-transparent hover:bg-muted"
      )}
      title={label}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
