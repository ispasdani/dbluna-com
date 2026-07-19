"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Canvas shortcut & control reference.
   Rendered as a floating help button on the canvas. Keep this list in sync
   with the handlers in canvas.tsx.
───────────────────────────────────────────────────────────────────────────── */
interface Shortcut {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["Scroll"], label: "Pan up / down" },
      { keys: ["Shift", "Scroll"], label: "Pan left / right" },
      { keys: ["Space", "Drag"], label: "Pan the canvas" },
      { keys: ["Middle-click", "Drag"], label: "Pan the canvas" },
    ],
  },
  {
    title: "Zoom",
    items: [
      { keys: ["Ctrl / ⌘", "Scroll"], label: "Zoom to cursor" },
    ],
  },
  {
    title: "Selection",
    items: [
      { keys: ["Click"], label: "Select a table / note" },
      { keys: ["Shift", "Click"], label: "Add to selection" },
      { keys: ["Drag"], label: "Marquee select" },
      { keys: ["Shift", "Drag"], label: "Add marquee to selection" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: ["Delete"], label: "Delete selected" },
      { keys: ["Backspace"], label: "Delete selected" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function CanvasShortcutsHelp({ className }: { className?: string }) {
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full bg-background/90 backdrop-blur shadow-sm"
            title="Keyboard shortcuts & controls"
            aria-label="Keyboard shortcuts and controls"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          className="w-72 max-h-[70vh] overflow-y-auto"
        >
          <DropdownMenuLabel className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Canvas controls
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {GROUPS.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {group.items.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-foreground">{s.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k, ki) => (
                          <Kbd key={ki}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
