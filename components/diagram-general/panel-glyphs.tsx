// 12×12 glyphs for the dock panels, drawn with the same strokes as TableNode
// so a panel row and its canvas row read as the same thing.

export function TableGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <rect x={1} y={1.5} width={10} height={9} rx={2} />
      <path d="M1 4.8H11M4.6 4.8V10.5" />
    </svg>
  );
}

/** Tinted with the table colour, read from `--tc` on an ancestor. */
export function KeyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--tc)" strokeWidth={1.4} strokeLinecap="round">
      <circle cx={3.6} cy={6} r={2.6} />
      <path d="M6.2 6H11.4M9.6 6V8.2M11.4 6V7.8" />
    </svg>
  );
}

export function LinkGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M4.6 7.4 7.4 4.6" />
      <path d="M6.2 3.2 7.3 2.1a2.3 2.3 0 0 1 3.3 3.3L9.5 6.5" />
      <path d="M5.8 8.8 4.7 9.9a2.3 2.3 0 0 1-3.3-3.3L2.5 5.5" />
    </svg>
  );
}

export function UniqueGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
      <path d="M6 2.4 9.6 6 6 9.6 2.4 6Z" />
    </svg>
  );
}

/** Sticky note with a folded corner. */
export function NoteGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 1.5h7a1 1 0 0 1 1 1V7.5L7.5 10.5h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M10.5 7.5H8.5a1 1 0 0 0-1 1v2" />
    </svg>
  );
}

/** Dashed frame, like an area on the canvas. */
export function AreaGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeDasharray="2.2 1.8">
      <rect x={1.2} y={1.2} width={9.6} height={9.6} rx={2} />
    </svg>
  );
}

/** Short list with bullets — a named set of values. */
export function EnumGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M4.5 3h6M4.5 6h6M4.5 9h6" />
      <circle cx={1.8} cy={3} r={0.6} fill="currentColor" />
      <circle cx={1.8} cy={6} r={0.6} fill="currentColor" />
      <circle cx={1.8} cy={9} r={0.6} fill="currentColor" />
    </svg>
  );
}
