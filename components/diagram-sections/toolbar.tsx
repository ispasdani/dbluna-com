"use client";

import { useState } from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { Check, ChevronDown, Eye, Focus, Grid3x3, Grip, Magnet, PanelLeft, PanelTop, Palette } from "lucide-react";

import { DiagramButton } from "@/components/diagram-general/diagram-button";
import { StylePreview } from "@/components/diagram-general/style-preview";
import menu from "@/components/diagram-general/toolbar-menus.module.scss";
import { cn } from "@/lib/utils";

import { useViewStore } from "@/store/useViewStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import { countRender } from "@/lib/debug-profiler";
import { TabsDropdown } from "../diagram-general/tabs-dropdown";
import { useCanvasStyleStore } from "@/store/useCanvasStyleStore";
import { CANVAS_STYLES, CANVAS_STYLE_ORDER, isCanvasStyleId } from "./canvas/canvas-style";
import { CODE_FONTS, STYLED_PANELS, usePanelStyleStore, type CodeFont, type StyledPanel } from "@/store/usePanelStyleStore";
import { PANEL_STYLES, PANEL_STYLE_ORDER, isPanelStyleId } from "../diagram-general/panel-style";

/** Keeps the menu open after picking, so several settings can be changed in one go. */
const stayOpen = (e: Event) => e.preventDefault();

// ─── View ────────────────────────────────────────────────────────────────────

function SwitchRow({
  checked,
  onToggle,
  icon,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Menu.CheckboxItem className={menu.item} checked={checked} onCheckedChange={onToggle} onSelect={stayOpen}>
      <span className={menu.icon}>{icon}</span>
      <span className={menu.text}>
        {label}
        <small>{hint}</small>
      </span>
      <span className={menu.switch} aria-hidden />
    </Menu.CheckboxItem>
  );
}

function ViewMenu() {
  countRender("TabLauncherBar body"); // TEMP diagnostics
  const { isLeftDockVisible, isTopNavbarVisible, toggleLeftDock, toggleTopNavbar } = useViewStore();
  const background = useCanvasStore((s) => s.background);
  const setBackground = useCanvasStore((s) => s.setBackground);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);
  const isFocusModeEnabled = useCanvasStore((s) => s.isFocusModeEnabled);
  const toggleFocusMode = useCanvasStore((s) => s.toggleFocusMode);

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <DiagramButton variant="outlined">
          <Eye className="w-3.5 h-3.5" />
          View
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </DiagramButton>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className={cn(menu.menu, menu.view)}>
          <Menu.Label className={menu.group}>Panels</Menu.Label>
          <SwitchRow
            checked={isLeftDockVisible}
            onToggle={toggleLeftDock}
            icon={<PanelLeft className="w-4 h-4" />}
            label="Left dock"
            hint="Tabs on the left side"
          />
          <SwitchRow
            checked={isTopNavbarVisible}
            onToggle={toggleTopNavbar}
            icon={<PanelTop className="w-4 h-4" />}
            label="Top navbar"
            hint="Title, share and history"
          />

          <Menu.Separator className={menu.sep} />

          <Menu.Label className={menu.group}>Canvas</Menu.Label>
          <SwitchRow
            checked={snapToGrid}
            onToggle={toggleSnapToGrid}
            icon={<Magnet className="w-4 h-4" />}
            label="Snap to grid"
            hint="Tables line up as you drag"
          />
          <SwitchRow
            checked={isFocusModeEnabled}
            onToggle={toggleFocusMode}
            icon={<Focus className="w-4 h-4" />}
            label="Focus mode"
            hint="Fade what isn't selected"
          />

          <Menu.Label className={menu.group}>Background</Menu.Label>
          <Menu.RadioGroup
            className={menu.segmented}
            value={background}
            onValueChange={(v) => (v === "grid" || v === "dots") && setBackground(v)}
          >
            <Menu.RadioItem value="grid" className={menu.segItem} onSelect={stayOpen}>
              <Grid3x3 className="w-3.5 h-3.5" />
              Grid
            </Menu.RadioItem>
            <Menu.RadioItem value="dots" className={menu.segItem} onSelect={stayOpen}>
              <Grip className="w-3.5 h-3.5" />
              Dots
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

// ─── Style ───────────────────────────────────────────────────────────────────

/** Left-hand categories: the canvas, each dock tab with its own style, the code font. */
type StyleCategory = "canvas" | StyledPanel | "font";

function StyleMenu() {
  const styleId = useCanvasStyleStore((s) => s.styleId);
  const setStyleId = useCanvasStyleStore((s) => s.setStyleId);
  const panelStyles = usePanelStyleStore((s) => s.styles);
  const setPanelStyle = usePanelStyleStore((s) => s.setStyle);
  const codeFont = usePanelStyleStore((s) => s.codeFont);
  const setCodeFont = usePanelStyleStore((s) => s.setCodeFont);
  const [category, setCategory] = useState<StyleCategory>("canvas");

  const catLabel = (c: StyleCategory) =>
    c === "canvas" ? "Canvas style" : c === "font" ? "Code font" : STYLED_PANELS.find((p) => p.id === c)!.label;
  const catValue = (c: StyleCategory) =>
    c === "canvas"
      ? CANVAS_STYLES[styleId].label
      : c === "font"
        ? CODE_FONTS.find((f) => f.id === codeFont)!.label
        : PANEL_STYLES[panelStyles[c]].label;

  // Hovering or arrowing onto a category shows its options straight away.
  const renderCat = (id: StyleCategory) => (
    <Menu.Item
      key={id}
      className={cn(menu.cat, category === id && menu.catOn)}
      onSelect={(e) => {
        e.preventDefault();
        setCategory(id);
      }}
      onFocus={() => setCategory(id)}
    >
      {catLabel(id)}
      <small>{catValue(id)}</small>
    </Menu.Item>
  );

  let options: React.ReactNode;
  if (category === "canvas") {
    options = (
      <Menu.RadioGroup value={styleId} onValueChange={(v) => isCanvasStyleId(v) && setStyleId(v)}>
        {CANVAS_STYLE_ORDER.map((id) => (
          <Menu.RadioItem key={id} value={id} className={menu.item} onSelect={stayOpen}>
            <StylePreview variant={CANVAS_STYLES[id].table} />
            <span className={menu.text}>
              {CANVAS_STYLES[id].label}
              <small>{CANVAS_STYLES[id].description}</small>
            </span>
            <span className={menu.radio} aria-hidden />
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    );
  } else if (category === "font") {
    options = (
      <Menu.RadioGroup
        className={menu.fontCards}
        value={codeFont}
        onValueChange={(v) => CODE_FONTS.some((f) => f.id === v) && setCodeFont(v as CodeFont)}
      >
        {CODE_FONTS.map((f) => (
          <Menu.RadioItem key={f.id} value={f.id} className={menu.fontCard} onSelect={stayOpen}>
            <span className={menu.check} aria-hidden>
              <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
            </span>
            <span
              className={menu.aa}
              style={{ fontFamily: f.id === "mono" ? "var(--font-mono), ui-monospace, monospace" : "var(--font-sans)" }}
            >
              Aa
            </span>
            <span>{f.label}</span>
            <small>{f.description}</small>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    );
  } else {
    const panel = category;
    options = (
      <Menu.RadioGroup value={panelStyles[panel]} onValueChange={(v) => isPanelStyleId(v) && setPanelStyle(panel, v)}>
        {PANEL_STYLE_ORDER.map((id) => (
          <Menu.RadioItem key={id} value={id} className={menu.item} onSelect={stayOpen}>
            <StylePreview variant={PANEL_STYLES[id].variant} />
            <span className={menu.text}>
              {PANEL_STYLES[id].label}
              <small>{PANEL_STYLES[id].description}</small>
            </span>
            <span className={menu.radio} aria-hidden />
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    );
  }

  const optsHint =
    category === "canvas"
      ? "Tables and relationship lines on the canvas."
      : category === "font"
        ? "Typeface of the Code tab's editor."
        : `How the ${catLabel(category)} tab looks. Separate from the canvas and the other tabs.`;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <DiagramButton variant="outlined" title="Canvas, panel and code styles">
          <Palette className="w-3.5 h-3.5" />
          Style
          <span className={menu.trigValue}>· {CANVAS_STYLES[styleId].label}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </DiagramButton>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className={cn(menu.menu, menu.style)}>
          <div className={menu.split}>
            <div className={menu.cats}>
              <span className={menu.catGroup}>Canvas</span>
              {renderCat("canvas")}
              <span className={menu.catGroup}>Side panels</span>
              {STYLED_PANELS.map((p) => renderCat(p.id))}
              <span className={menu.catGroup}>Editor</span>
              {renderCat("font")}
            </div>
            <div className={menu.opts}>
              <div className={menu.optsHead}>
                <b>{catLabel(category)}</b>
                {optsHint}
              </div>
              {options}
            </div>
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

// ─── Bar ─────────────────────────────────────────────────────────────────────

export function TabLauncherBar() {
  return (
    <div className="h-12 border-b border-border bg-dock-header flex items-center justify-start px-3 gap-2">
      <ViewMenu />
      <StyleMenu />
      <TabsDropdown side="left" />
    </div>
  );
}
