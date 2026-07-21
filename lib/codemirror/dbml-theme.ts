import { EditorView } from "@uiw/react-codemirror";

// Shared CodeMirror theme for DBML editors (canvas code editor + docs preview),
// wired to the app's CSS variables so it tracks light/dark.
export const dbmlCodeMirrorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--dock-bg)",
    color: "var(--foreground)",
    height: "100%",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--dock-header)", // Slightly different to separate
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--accent)",
    color: "var(--foreground)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
  },
  ".cm-line": {
    fontFamily: "var(--font-mono)",
  },
  ".cm-tooltip-lint": {
    backgroundColor: "var(--popover) !important",
    color: "var(--popover-foreground) !important",
    border: "1px solid var(--border) !important",
  },
});
