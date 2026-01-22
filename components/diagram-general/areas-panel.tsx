"use client";

import { useCanvasStore, TABLE_COLORS } from "@/store/useCanvasStore";
import { 
  Plus, 
  Trash2, 
  Square,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AreasPanel() {
  const {
    areas,
    selectedAreaIds,
    addArea,
    updateArea,
    deleteArea,
    setSelectedAreaIds,
  } = useCanvasStore();

  const isSingleSelection = selectedAreaIds.length === 1;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <div>
           <h3 className="font-medium text-foreground">Areas</h3>
           <p className="text-xs text-muted-foreground">
             {areas.length} areas on canvas
           </p>
        </div>
        <Button onClick={addArea} size="sm" className="h-8 gap-1">
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {/* Areas List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {areas.map((area) => {
           const isSelected = selectedAreaIds.includes(area.id);

           return (
             <div 
               key={area.id} 
               className={cn(
                 "border rounded-md transition-all duration-200",
                 isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"
               )}
             >
               {/* Area Header Row */}
                <div 
                  className="flex items-center p-2 cursor-pointer select-none"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      if (isSelected) {
                        setSelectedAreaIds(selectedAreaIds.filter(id => id !== area.id));
                      } else {
                        setSelectedAreaIds([...selectedAreaIds, area.id]);
                      }
                    } else {
                      setSelectedAreaIds([area.id]);
                    }
                  }}
                >
                  {isSelected ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                  )}
                  
                  <div className="h-3 w-3 rounded sm:rounded-sm mr-2 shrink-0 border border-black/10" style={{ backgroundColor: area.color }} />
                  <span className="font-medium text-sm truncate flex-1">{area.title || "Untitled Area"}</span>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground mr-1"
                    onClick={(e) => {
                       e.stopPropagation();
                       updateArea(area.id, { isLocked: !area.isLocked });
                    }}
                  >
                    {area.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </Button>

                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-3.5 h-3.5 hover:text-destructive" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive gap-2"
                          onSelect={() => deleteArea(area.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete Area</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>

               {/* Expanded Details */}
               {isSelected && isSingleSelection && (
                 <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="mb-3 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input 
                        value={area.title} 
                        onChange={(e) => updateArea(area.id, { title: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Area Title"
                      />
                    </div>

                    <div className="space-y-1">
                       <label className="text-xs font-medium text-muted-foreground">Color</label>
                       <div className="grid grid-cols-8 gap-1">
                          {TABLE_COLORS.map((color) => (
                            <button
                              key={color}
                              className={cn(
                                "w-6 h-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                                area.color === color && "ring-2 ring-primary ring-offset-1"
                              )}
                              style={{ backgroundColor: color }}
                              onClick={() => updateArea(area.id, { color })}
                              title={color}
                            />
                          ))}
                       </div>
                    </div>
                 </div>
               )}
             </div>
           );
        })}
        {areas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
             <Square className="w-8 h-8 opacity-20 dashed" />
             <p>No areas yet.</p>
             <Button variant="outline" size="sm" onClick={addArea}>Create Area</Button>
          </div>
        )}
      </div>
    </div>
  );
}
