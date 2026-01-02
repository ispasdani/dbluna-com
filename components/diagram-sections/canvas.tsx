import { MousePointer2 } from "lucide-react";

export function CanvasPlaceholder() {
  return (
    <div className="w-full min-w-[400px] h-full bg-canvas-bg canvas-grid flex items-center justify-center relative overflow-hidden">
      {/* Center content */}
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center border border-border">
          <MousePointer2 className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-foreground mb-1">
            Canvas (placeholder)
          </h3>
          <p className="text-sm text-muted-foreground">
            Your diagram will render here
          </p>
        </div>
      </div>

      {/* Corner coordinates */}
      <div className="absolute bottom-4 right-4 font-mono text-xs text-muted-foreground/50">
        0, 0
      </div>
    </div>
  );
}
