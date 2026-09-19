"use client";

import { DropdownMenu as Menu } from "radix-ui";
import { Check, Maximize, Minus, Plus } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { cn } from "@/lib/utils";
import { fitDiagramOnCanvas } from "./use-diagram-issues";
import menu from "./toolbar-menus.module.scss";
import styles from "./canvas-floating-toolbar.module.scss";

const PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const STEP = 1.1;

/** Zoom stepper: − 100% + and fit; the percentage opens the presets. */
export function ZoomMenu() {
  const zoom = useEditorStore((s) => s.camera.zoom);
  const viewport = useEditorStore((s) => s.viewport);
  const setZoomAt = useEditorStore((s) => s.setZoomAt);

  const zoomPct = Math.round(zoom * 100);
  // Zoom around the middle of the canvas, so what's centred stays centred.
  const applyZoom = (z: number) => setZoomAt(z, viewport.w / 2, viewport.h / 2);

  return (
    <>
      <button type="button" className={styles.icon} onClick={() => applyZoom(zoom / STEP)} title="Zoom out">
        <Minus className="size-4" />
        <span className="sr-only">Zoom out</span>
      </button>

      <Menu.Root>
        <Menu.Trigger asChild>
          <button type="button" className={styles.zoomValue} title="Zoom presets">
            {zoomPct}%
          </button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content side="top" align="center" sideOffset={10} className={cn(menu.menu, styles.zoomMenu)}>
            <Menu.Label className={menu.group}>Zoom</Menu.Label>
            <Menu.Item className={menu.item} onSelect={fitDiagramOnCanvas}>
              <span className={menu.icon}>
                <Maximize className="size-4" />
              </span>
              <span className={menu.text}>Fit to screen</span>
            </Menu.Item>
            <Menu.Separator className={menu.sep} />
            {PRESETS.map((z) => {
              const active = Math.abs(z - zoom) < 0.001;
              return (
                <Menu.Item key={z} className={cn(menu.item, menu.plain)} onSelect={() => applyZoom(z)}>
                  <span className={menu.text}>{Math.round(z * 100)}%</span>
                  {active && <Check className={cn("size-3.5", menu.tick)} />}
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <button type="button" className={styles.icon} onClick={() => applyZoom(zoom * STEP)} title="Zoom in">
        <Plus className="size-4" />
        <span className="sr-only">Zoom in</span>
      </button>
      <button type="button" className={styles.icon} onClick={fitDiagramOnCanvas} title="Fit to screen">
        <Maximize className="size-4" />
        <span className="sr-only">Fit to screen</span>
      </button>
    </>
  );
}
