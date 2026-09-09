"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Runs `fn` once, on unmount, always with its latest identity.
 *
 * Every text field here commits on blur rather than per keystroke, since a
 * store write re-runs the Code tab's DBML regeneration and re-arms both
 * autosave debounces. Switching dock tabs unmounts the panel *without* firing
 * blur, so without this a pending edit would be silently dropped.
 */
export function useCommitOnUnmount(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => () => ref.current(), []);
}

/**
 * Text input holding a local draft, committing on blur. An external change to
 * `value` (typically the Code tab re-parsing DBML) is adopted during render —
 * React's documented alternative to a sync effect — but never while this field
 * owns the edit, so a keystroke is not clobbered mid-type.
 */
export function CommittedInput({
  value,
  onCommit,
  className,
  ...props
}: {
  value: string;
  onCommit: (next: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur">) {
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (!isEditing) setDraft(value);
  }

  const commit = useCallback(() => {
    if (draft === value) return;
    onCommit(draft);
  }, [draft, value, onCommit]);

  useCommitOnUnmount(commit);

  return (
    <Input
      {...props}
      className={className}
      value={draft}
      onChange={(e) => {
        setIsEditing(true);
        setDraft(e.target.value);
      }}
      onBlur={() => {
        setIsEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
