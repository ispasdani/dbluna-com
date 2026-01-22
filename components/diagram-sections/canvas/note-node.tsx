"use client";

import { useCanvasStore, type Note, TABLE_COLORS } from "@/store/useCanvasStore";
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

interface NoteNodeProps {
  note: Note;
  selected?: boolean;
}

export function NoteNode({ note, selected }: NoteNodeProps) {
  const updateNote = useCanvasStore((s) => s.updateNote);
  const deleteNote = useCanvasStore((s) => s.deleteNote);

  // Styling constants
  const HEADER_HEIGHT = 40;
  
  return (
    <g transform={`translate(${note.x}, ${note.y})`}>
      {/* 
        Container Rect
        - Resizable width/height
        - Color theme based
      */}
      <rect
        x={0}
        y={0}
        width={note.width}
        height={note.height}
        rx={8}
        fill={note.color} // Using the note color as background like sticky note
        fillOpacity={0.2} // Slight transparency for sticky note feel
        stroke={selected ? "var(--primary)" : note.color}
        strokeWidth={selected ? 2 : 1}
        className="transition-colors duration-200"
        style={{ filter: "drop-shadow(0 2px 4px rgb(0 0 0 / 0.1))" }}
      />
      
      {/* Accent Top Strip (Optional, adds to "sticky" look or stronger color header) */}
      <path
        d={`M1 1 Q 1 1 1 1 L${note.width - 1} 1 Q ${note.width - 1} 1 ${note.width - 1} 1 L${note.width - 1} ${HEADER_HEIGHT} L1 ${HEADER_HEIGHT} Z`}
        fill={note.color}
        fillOpacity={0.4}
        style={{ clipPath: "inset(0 0 0 0 round 7px 7px 0 0)" }}
      />

      {/* Title Display (Non-editable on canvas to allow drag) */}
      <foreignObject
        x={0}
        y={0}
        width={note.width}
        height={HEADER_HEIGHT}
        className="overflow-visible"
        style={{ pointerEvents: "none" }} // Let clicks pass through to <g> for drag, BUT buttons need events
      >
        <div className="w-full h-full flex items-center px-3 gap-2">
            {/* Title Text */}
            <div 
               className="font-semibold text-foreground w-full text-sm truncate select-none"
               title={note.title || "Untitled Note"}
            >
               {note.title || "Untitled Note"}
            </div>
            
            {/* Action Buttons - Re-enable pointer events */}
            <div className="flex items-center pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-6 w-6 hover:bg-black/10 text-foreground/60"
                 onClick={() => updateNote(note.id, { isLocked: !note.isLocked })}
               >
                 {note.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
               </Button>
               
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-black/10 text-foreground/60"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Color</DropdownMenuLabel>
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {TABLE_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                            note.color === color && "ring-2 ring-primary ring-offset-1"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNote(note.id, { color });
                          }}
                        />
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive gap-2"
                      onSelect={() => deleteNote(note.id)}
                    >
                      <Trash className="h-4 w-4" />
                      <span>Delete Note</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
        </div>
      </foreignObject>

      {/* Content Textarea */}
      <foreignObject
        x={0}
        y={HEADER_HEIGHT}
        width={note.width}
        height={note.height - HEADER_HEIGHT}
      >
        <textarea
           className="w-full h-full p-3 bg-transparent border-none outline-none resize-none text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50"
           value={note.content}
           placeholder="Type something..."
           onChange={(e) => updateNote(note.id, { content: e.target.value })}
           onPointerDown={(e) => e.stopPropagation()} // Stop propagation so we can type without dragging
           style={{ pointerEvents: note.isLocked ? "none" : "auto" }} 
        />
      </foreignObject>

      {/* Resize Handles (Horizontal Only) - Only when selected and not locked */}
      {selected && !note.isLocked && (
        <>
            {/* Left Handle */}
            <rect
                x={-6} // Increased hit area
                y={0}
                width={12} // Increased hit area
                height={note.height}
                fill="transparent"
                style={{ cursor: "ew-resize" }}
                className="hover:fill-primary/20"
                data-note-resize="left"
                data-note-id={note.id}
            />
            {/* Right Handle */}
            <rect
                x={note.width - 6} // Increased hit area
                y={0}
                width={12} // Increased hit area
                height={note.height}
                fill="transparent"
                style={{ cursor: "ew-resize" }}
                className="hover:fill-primary/20"
                data-note-resize="right"
                data-note-id={note.id}
            />
        </>
      )}
    </g>
  );
}
