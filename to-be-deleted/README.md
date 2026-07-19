# to-be-deleted

Files moved here during the 2026-07-19 cleanup. **Nothing in this folder is imported or used by the app.** It is excluded from `tsconfig.json` and ESLint. Once you've confirmed you don't need any of it, delete the whole folder.

## Unused source components / modules
- `components/component-example.tsx` + `components/example.tsx` — scaffolding/demo components, not referenced anywhere.
- `store/connection.ts` — orphaned store, never imported.
- `ui/table.tsx`, `ui/resizable.tsx`, `ui/collapsible.tsx`, `ui/context-menu.tsx` — shadcn UI primitives that were generated but never used.
- `components/divideY.tsx` — unused marketing divider (`divideX` is the one actually used).
- `components/sunIcon.tsx`, `components/moonIcon.tsx` — unused theme icons.

## Root-level junk
- `root/old_globals.css` — superseded by `app/globals.css`.
- `root/old_platformPaletteProvider.tsx` — superseded by `themeProviders/platformPaletteProvider.tsx`.
- `root/globals_history.txt`, `root/log.txt` — stray logs.
- `root/sampleData.jsonl` — unreferenced sample data.

## Tooling output
- `graphify-out/` — output of the "graphify" code-graph tool (commit 6c9dfc2 noted it "needs to be ignored later"). Not part of the app.
