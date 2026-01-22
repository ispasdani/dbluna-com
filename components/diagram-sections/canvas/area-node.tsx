"use client";

import { useCanvasStore, type Area } from "@/store/useCanvasStore";
import { Lock, Unlock, MoreVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AreaNodeProps {
  area: Area;
  selected?: boolean;
}

// DrawDB areas are usually dashed borders with a label
export function AreaNode({ area, selected }: AreaNodeProps) {
  const updateArea = useCanvasStore((s) => s.updateArea);
  const deleteArea = useCanvasStore((s) => s.deleteArea);

  return (
    <g transform={`translate(${area.x}, ${area.y})`}>
      {/* Border & Background */}
      <rect
        x={0}
        y={0}
        width={area.width}
        height={area.height}
        rx={8}
        fill={area.color}
        fillOpacity={0.05}
        stroke={selected ? "var(--primary)" : area.color}
        strokeWidth={selected ? 2 : 2}
        strokeDasharray="8,4"
        style={{ pointerEvents: area.isLocked ? "none" : "visible" }} 
        // pointerEvents needs to be handled carefully. 
        // If we want to drag it, we need events. But it shouldn't block selection of items inside? 
        // SVG order handles visual block, but pointer events might "catch" click if fill is present.
        // fillOpacity 0.05 is clickable.
      />

      {/* Label Area */}
      <foreignObject
        x={0}
        y={-30} // Place label outside top-left? or inside? DrawDB places it Top-Left inside or outside. Let's try inside top-left
        width={area.width}
        height={30}
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-center gap-2 px-2 h-full pointer-events-auto w-fit">
           <span className="text-sm font-bold text-muted-foreground select-none bg-background/50 px-2 rounded">
             {area.title}
           </span>
           
           {selected && (
             <div className="flex items-center bg-background border rounded shadow-sm">
                <Button
                   variant="ghost" 
                   size="icon"
                   className="h-6 w-6"
                   onClick={() => updateArea(area.id, { isLocked: !area.isLocked })}
                >
                   {area.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </Button>
                <Button
                   variant="ghost" 
                   size="icon"
                   className="h-6 w-6 text-destructive"
                   onClick={() => deleteArea(area.id)}
                >
                   <Trash className="h-3 w-3" />
                </Button>
             </div>
           )}
        </div>
      </foreignObject>
      
      {/* Resize Handles - All corners + edges */}
      {selected && !area.isLocked && (
         <>
            {/* Top-Left */}
            <rect x={-4} y={-4} width={8} height={8} fill="var(--background)" stroke="var(--primary)" rx={1} style={{cursor:"nwse-resize"}} data-area-resize="tl" data-area-id={area.id} />
            {/* Top-Right */}
            <rect x={area.width-4} y={-4} width={8} height={8} fill="var(--background)" stroke="var(--primary)" rx={1} style={{cursor:"nesw-resize"}} data-area-resize="tr" data-area-id={area.id} />
            {/* Bottom-Left */}
            <rect x={-4} y={area.height-4} width={8} height={8} fill="var(--background)" stroke="var(--primary)" rx={1} style={{cursor:"nesw-resize"}} data-area-resize="bl" data-area-id={area.id} />
            {/* Bottom-Right */}
            <rect x={area.width-4} y={area.height-4} width={8} height={8} fill="var(--background)" stroke="var(--primary)" rx={1} style={{cursor:"nwse-resize"}} data-area-resize="br" data-area-id={area.id} />
         </>
      )}
    </g>
  );
}
