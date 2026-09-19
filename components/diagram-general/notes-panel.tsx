"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronsDownUp, Crosshair, Lock, Plus, Search, StickyNote, Trash2 } from "lucide-react";

import { useCanvasStore, TABLE_COLORS, type Note } from "@/store/useCanvasStore";
import { usePanelStyle } from "@/store/usePanelStyleStore";
import { cn } from "@/lib/utils";
import { CommittedInput, CommittedTextarea } from "./committed-input";
import { NoteGlyph } from "./panel-glyphs";
import { focusNoteOnCanvas } from "./use-diagram-issues";
import styles from "./notes-panel.module.scss";

const tc = (color: string) => ({ "--tc": color }) as CSSProperties;

function wordCount(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${words} word${words === 1 ? "" : "s"}`;
}

export function NotesPanel() {
  const notes = useCanvasStore((s) => s.notes);
  const selectedNoteIds = useCanvasStore((s) => s.selectedNoteIds);
  const addNote = useCanvasStore((s) => s.addNote);
  const updateNote = useCanvasStore((s) => s.updateNote);
  const deleteNote = useCanvasStore((s) => s.deleteNote);
  const setSelectedNoteIds = useCanvasStore((s) => s.setSelectedNoteIds);
  const { variant } = usePanelStyle("notes");

  const isSingleSelection = selectedNoteIds.length === 1;
  const selectionKey = selectedNoteIds.join(",");

  // Cards start closed. Expansion is tracked apart from selection so a card can
  // be folded by clicking its header again without losing the canvas selection.
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(
    isSingleSelection ? selectedNoteIds[0] : null
  );
  const [query, setQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // A note picked on the canvas opens its card and scrolls to it.
  useEffect(() => {
    const id = selectedNoteIds.length === 1 ? selectedNoteIds[0] : null;
    setExpandedNoteId(id);
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      const box = bodyRef.current;
      const el = box?.querySelector(`[data-note-id="${CSS.escape(id)}"]`);
      if (!box || !el) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top || r.top > b.bottom - 80) {
        box.scrollTo({ top: box.scrollTop + r.top - b.top - 12, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
    // Only react to an actual change of selection, not to unrelated store updates,
    // so a manual collapse isn't immediately undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const needle = query.trim().toLowerCase();
  const visible = notes.filter(
    (n) => !needle || needle.split(/\s+/).every((w) => `${n.title} ${n.content}`.toLowerCase().includes(w))
  );

  const onHeaderClick = (e: React.MouseEvent | React.KeyboardEvent, note: Note) => {
    const isSelected = selectedNoteIds.includes(note.id);
    if (e.ctrlKey || e.metaKey) {
      setSelectedNoteIds(
        isSelected ? selectedNoteIds.filter((id) => id !== note.id) : [...selectedNoteIds, note.id]
      );
      return;
    }
    if (isSelected && isSingleSelection) {
      setExpandedNoteId(expandedNoteId === note.id ? null : note.id);
    } else {
      setSelectedNoteIds([note.id]);
    }
  };

  const onKey = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const renderNote = (note: Note) => {
    const isSelected = selectedNoteIds.includes(note.id);
    const isOpen = expandedNoteId === note.id && isSingleSelection;
    const title = note.title.trim();
    const content = note.content.trim();

    return (
      <div
        key={note.id}
        data-note-id={note.id}
        className={cn(
          styles.tb,
          styles.card,
          styles.note,
          !isOpen && styles.closed,
          isOpen ? styles.cardOpen : isSelected && styles.cardSelected
        )}
        style={tc(note.color)}
      >
        <div
          className={styles.tbHead}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={(e) => onHeaderClick(e, note)}
          onKeyDown={(e) => onKey(e, () => onHeaderClick(e, note))}
        >
          <span className={styles.chev}>
            <ChevronDown className="w-3 h-3" />
          </span>
          <span className={styles.mk} style={tc(note.color)}>
            <NoteGlyph />
          </span>
          <span className={cn(styles.tname, !title && styles.untitled)} title={title || undefined}>
            {title || "Untitled note"}
          </span>
          <span className={styles.meta}>
            {note.isLocked && (
              <span className={cn(styles.metaItem, styles.locked)} title="Locked">
                <Lock className="w-3 h-3" />
              </span>
            )}
          </span>
        </div>

        {/* Closed cards show the start of the note; the compact style stays one line. */}
        {!isOpen && variant !== "dense" && (
          <p
            className={cn(styles.preview, !content && styles.previewEmpty)}
            onClick={(e) => onHeaderClick(e, note)}
          >
            {content || "Empty note"}
          </p>
        )}

        {isOpen && (
          <div className={styles.settings}>
            <label className={styles.field}>
              Title
              <CommittedInput
                value={note.title}
                onCommit={(next) => updateNote(note.id, { title: next })}
                placeholder="Untitled note"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              Content
              <CommittedTextarea
                value={note.content}
                onCommit={(next) => updateNote(note.id, { content: next })}
                placeholder="Decisions, open questions, anything worth keeping next to the schema"
                className={styles.content}
              />
              <span className={styles.wordCount}>{wordCount(note.content)}</span>
            </label>

            <div className={styles.sec}>
              <h4>Color</h4>
              <div className={styles.swatches}>
                {TABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={note.color === color}
                    style={{ "--c": color } as CSSProperties}
                    onClick={() => updateNote(note.id, { color })}
                  />
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={() => focusNoteOnCanvas(note.id)}>
                <Crosshair className="w-3.5 h-3.5" />
                Show on canvas
              </button>
              <button
                type="button"
                className={cn(styles.btn, note.isLocked && styles.btnOn)}
                aria-pressed={note.isLocked}
                onClick={() => updateNote(note.id, { isLocked: !note.isLocked })}
              >
                <Lock className="w-3.5 h-3.5" />
                {note.isLocked ? "Locked" : "Lock"}
              </button>
              <button type="button" className={cn(styles.btn, styles.btnDanger)} onClick={() => deleteNote(note.id)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.panel} data-v={variant}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>Notes</h3>
          <span className={styles.count}>{needle ? `${visible.length} / ${notes.length}` : notes.length}</span>
          <span className={styles.spacer} />
          {expandedNoteId && isSingleSelection && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Close the open note"
              aria-label="Close the open note"
              onClick={() => setExpandedNoteId(null)}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={addNote}>
            <Plus className="w-3.5 h-3.5" />
            Add note
          </button>
        </div>
        {notes.length > 0 && (
          <label className={styles.search}>
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter notes"
              aria-label="Filter notes"
            />
          </label>
        )}
      </div>

      <div className={styles.body} ref={bodyRef}>
        {notes.length === 0 ? (
          <div className={styles.emptyState}>
            <StickyNote className="w-8 h-8" />
            <p>Notes sit next to your tables on the canvas. Add one for decisions or open questions.</p>
            <button type="button" className={styles.btn} onClick={addNote}>
              <Plus className="w-3.5 h-3.5" />
              Add note
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>No notes match “{query.trim()}”.</div>
        ) : (
          <div className={styles.list}>{visible.map(renderNote)}</div>
        )}
      </div>
    </div>
  );
}
