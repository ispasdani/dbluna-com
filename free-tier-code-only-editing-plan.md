# Free Tier: Code-Tab-Only Editing — Implementation Plan

## Context

Right now Free-plan users are fully read-only on `/d/[id]` (`editingReadOnly = EDITING_GATE_ENABLED
&& !isPro`, [app/(diagram)/d/[id]/page.tsx:47](<app/(diagram)/d/[id]/page.tsx#L47>)). They can open a
diagram (their own local one, or one they're a member of) but cannot create, edit, or add anything.
Cloud diagram creation is hard-Pro-gated server-side (`requireSignedInPro`,
[convex/diagrams.ts:104](convex/diagrams.ts#L104)).

This plan changes that: Free users get real editing power, but constrained to one surface (the DBML
Code tab) and two numeric caps (10 tables/diagram, 5 diagrams total). No cloud access changes — Free
stays local-only (IndexedDB via Zustand), exactly as today.

### Relationship to the three previously-flagged gaps

| Gap | Status after this plan |
|---|---|
| #1 — Invited "editor" role is non-functional for a Free-plan collaborator (`requireProDiagramEditor` checks the *invitee's* plan, not the owner's) | **Fixed**, in scope now — see §7. The entitlement check moves from "does the requesting collaborator have Pro" to "does the diagram's owner have Pro," matching the pricing page's existing "Team members: Up to 5" promise (the owner's subscription entitles the diagram, not each collaborator individually). |
| #2 — Free tier's "Get started" CTA points at `/w`, which doesn't exist | **Addressed, differently than first drafted.** No new landing/list page — `MyDiagramsDialog` and the diagram-selector dropdown already cover diagram management once inside `/d/[id]`. The actual gap was only "how does a brand-new user get into a diagram at all," solved by a silent auto-create-and-redirect route at `/d` (§5) plus wiring Clerk's post-sign-up redirect to land there (§9, new — this was undiscovered until this pass; there's no `ClerkProvider` or custom sign-up page at the app root today, sign-up is fully Clerk-hosted). |
| #3 — `tablesPerDiagram: 20` / 1-workspace claims in `convex/plans.ts` are stored but never enforced | **Fixed** — replaced with real, enforced numbers (10 tables / 5 diagrams), defined once and consumed by both the enforcement code and the marketing copy so they can't drift apart again. |

## Goals

- Free users can create/edit tables, columns, and relationships (via DBML `Ref:` syntax) through the
  **Code tab only**.
- Canvas stays **visible but non-interactive** for Free (pan/zoom/select to view the result of a code
  edit; no drag, no click-to-add, no inline editing).
- All other dock tabs (Schema, Issues, Templates, Tables, Relationships, Notes, Areas, AI Chat) and the
  Docs workspace mode are **hidden**, not just disabled, for Free.
- Hard caps: **10 tables per diagram**, **5 diagrams total**, both enforced client-side with a clear
  upgrade prompt when hit.
- A freshly-joined Free user lands directly in a diagram (auto-created), not on a separate landing
  page or the marketing homepage.
- An onboarding modal explains the Code-tab-only model on first visit, and stays reachable anytime
  afterward from a helper icon — never blocks usage, always closable.
- No change to cloud/Pro behavior, no change to the existing Convex-side Pro gates.

## Non-goals

- Not touching `/d/view` (anonymous share-link viewer) — unrelated read-only surface, already correct.
- Not adding server-side (Convex) enforcement of the 10-table/5-diagram caps — Free diagrams never
  reach Convex, so there
  is nothing to enforce there yet. If Free ever gets optional cloud backup, this needs revisiting.

## Open questions

Resolved:

1. ~~Issues tab vs. "Basic schema validation."~~ **Decided: hide it for Free.** Neither `IssuesPanel`
   nor `TemplatesPanel` has any existing tiered ("basic" vs "advanced") behavior to preserve — the
   pricing copy promising "Basic" was aspirational, the same kind of drift as the unenforced
   `tablesPerDiagram: 20` claim gap #3 already fixes. Hide the tab, change that pricing row
   ([constants/pricing.tsx:238-244](constants/pricing.tsx#L238-L244)) to "—" for Free. A lightweight
   teaser ("3 issues found — upgrade to see them") could be a future growth hook, but is out of scope
   here.
2. ~~Templates tab vs. "Basic templates."~~ **Decided: hide it for Free**, same reasoning as above.
   Change that pricing row ([constants/pricing.tsx:246-252](constants/pricing.tsx#L246-L252)) to "—".

4. ~~Scope of Phase 3 (the landing page).~~ **Moot — no landing/list page is being built.**
   `MyDiagramsDialog` (rename/duplicate/delete) and the diagram-selector dropdown in `TopNavbar`
   already cover diagram management once a user is inside `/d/[id]`. The only real gap was getting a
   brand-new user into a diagram at all, which is now a silent redirect (§5), not a page.
5. ~~Route for the landing page.~~ **Decided: `/d` (bare), and it's not a visible page.** Since it's
   now an invisible auto-create-and-redirect route rather than a UI users see, the earlier `/w` vs `/d`
   stakes mostly disappear — `/d` is used purely because it's a sibling of `/d/[id]`, `/d/view`,
   `/d/join`, `/d/cloud` and inherits their shared layout
   ([app/(diagram)/layout.tsx](<app/(diagram)/layout.tsx>)) and the middleware's existing "everything
   under `/d/*` requires sign-in except `/d/view`" rule ([proxy.ts:30](proxy.ts#L30)) for free.

Still open — need your call before implementation:

3. **Grandfathering existing over-cap state.** A user could already have >10 tables in a diagram or >5
   diagrams (built while unrestricted, or downgraded from Pro). Recommendation: never delete data —
   let them keep and view everything, but block *new* table/diagram creation once at/over cap, with a
   banner explaining why. Confirm this is the behavior you want.
6. **Does the onboarding modal apply to Pro too?** Default assumption below is Free-only (it exists to
   explain constraints Pro doesn't have). If you want a lighter generic product-tour version for Pro
   reusing the same helper icon, say so — not currently planned.

## Current tab inventory (for reference)

From [store/useDockStore.tsx:3-22](store/useDockStore.tsx#L3-L22):

| Tab id | Label | Free (proposed) | Pro |
|---|---|---|---|
| `code` | Code | ✅ visible, **editable** | ✅ visible, editable |
| `schema` | Schema | — (unimplemented placeholder today regardless) | same |
| `issues` | Issues | ❌ hidden | ✅ |
| `templates` | Templates | ❌ hidden | ✅ |
| `tables` | Tables | ❌ hidden | ✅ |
| `relationships` | Relationships | ❌ hidden | ✅ |
| `notes` | Notes | ❌ hidden | ✅ |
| `areas` | Areas | ❌ hidden | ✅ |
| `ai-chat` | AI Chat | ❌ hidden | ✅ (existing Pro/credit gating already applies) |

Plus the top-level `workspaceMode` toggle (`diagram` ↔ `docs`,
[store/useViewStore.tsx:12](store/useViewStore.tsx#L12), toggled from
[components/diagram-sections/top-navbar/top-navbar.tsx](components/diagram-sections/top-navbar/top-navbar.tsx)) —
Free loses the ability to switch to `docs` mode.

## Design

### 1. Single source of truth for caps

New file `lib/plan-limits.ts`:

```
export const FREE_MAX_TABLES_PER_DIAGRAM = 10;
export const FREE_MAX_DIAGRAMS = 5;
```

Imported by:
- The client-side enforcement points (below).
- `convex/plans.ts`'s Free plan `features` object, so the seeded plan metadata matches reality instead
  of drifting again (fixes the root cause of gap #3, not just the symptom).
- `constants/pricing.tsx`, so the "Diagrams" and "Tables per diagram" rows read "5" / "10" instead of
  the current "View only" / "20".

### 2. Capability computation replaces the single `editingReadOnly` boolean

`editingReadOnly` today is one flag threaded everywhere. It becomes too coarse once Free gets partial
edit rights. Replace its computation in
[app/(diagram)/d/[id]/page.tsx](<app/(diagram)/d/[id]/page.tsx>) with a small derived object:

```
const capabilities = {
  isPro,                                  // unchanged source: api.users.getCurrentUserPlan
  canEditCanvas: isPro,                   // canvas gestures (drag/click-add/inline edit)
  canEditCode: true,                      // both tiers may type in the Code tab...
  tableCap: isPro ? null : FREE_MAX_TABLES_PER_DIAGRAM,   // ...but Free is capped
  diagramCap: isPro ? null : FREE_MAX_DIAGRAMS,
  visibleTabs: isPro ? ALL_TABS : ["code"] as TabId[],
  canUseDocsMode: isPro,
};
```

While `hasHydrated`/`cloudReady`/plan-loading is false, default every flag to the most restrictive
(Free) value — same "never briefly show edit affordances before the real plan resolves" principle the
current code already follows for `editingReadOnly`.

Pass `capabilities` (or the individual fields it already passes today, expanded) down instead of the
single `readOnly` prop:
- `CanvasStage` gets `readOnly={!capabilities.canEditCanvas}` (was `editingReadOnly` — now Free is
  `true` here same as before, Pro unchanged).
- `CodeEditor` (inside `DockPanel`) gets its own `readOnly={!capabilities.canEditCode}` — **always
  `false`** for a signed-in user on their own/permitted diagram. This is the one place the boolean
  flips relative to today.
- `TopNavbar` / `TabLauncherBar` keep a `readOnly` prop but it now means "hide canvas-mutation
  affordances" (Add Table/Note/Area toolbar buttons, canvas-based table creation) —
  `!capabilities.canEditCanvas`, i.e. still `true` for Free. These were already gated this way; no
  behavior change here except the prop's meaning is now scoped to canvas, not "everything."
- `DockPanel` / `DockTabsHeader` filter the rendered tab list against `capabilities.visibleTabs` before
  mapping `TABS`, instead of always rendering all of `useDockStore`'s `leftTabs`/`rightTabs`. (The dock
  store itself still tracks open/closed/side state for all tabs — filtering happens at render time so
  we don't have to touch drag/drop or persistence logic.)
- `TopNavbar`'s workspace-mode toggle button (`setWorkspaceMode('docs')`) is hidden when
  `!capabilities.canUseDocsMode`.

Note: this is a client-side-only render gate (same trust model the app already uses for
`editingReadOnly`). No new Convex reads are needed beyond the existing `api.users.getCurrentUserPlan`
query already used to compute `isPro`.

### 3. Table cap enforcement (Code tab)

The DBML Code tab's edit flow parses the editor's text and applies it to `useCanvasStore` (via
`lib/parser/dsl-parser.ts` and whatever hook wires `CodeEditor`'s `onChange` to the store — confirm
exact call site during implementation, likely inside `components/diagram-general/code-editor.tsx` or a
sync hook it calls).

Add a guard at the point parsed DBML is about to be applied to the store:
- If `capabilities.tableCap != null && parsedTables.length > capabilities.tableCap`: **do not apply**
  the change. Surface an inline error in the Code tab (reuse whatever error-display mechanism already
  exists for DBML parse errors — confirm in `code-editor.tsx`) reading something like "Free plan is
  capped at 10 tables per diagram. Remove some tables or upgrade to Pro." Do not silently truncate the
  user's table list — that would look like data loss.
- The editor keeps the user's *typed* text (so they don't lose their edit), it just doesn't commit to
  the store until they're back under the cap or upgrade.

This mirrors the existing pattern where DBML parse errors already block the sync (needs confirming
against current `dsl-parser.ts` error-handling, but the "don't apply, show inline error" shape should
already exist for syntax errors — this is the same UX for a semantic/limit error).

### 4. Diagram cap enforcement (create-new-diagram flow)

Two call sites create a new *local* diagram entry, both going through `useCanvasStore`'s
`createDiagram` ([store/useCanvasStore.tsx:326](store/useCanvasStore.tsx#L326)):
- [components/diagram-sections/top-navbar/top-navbar.tsx:215](components/diagram-sections/top-navbar/top-navbar.tsx#L215)
  (the "Create New Diagram" dialog, reached from the diagram-selector dropdown).
- The new landing page (Phase 3, §5), which needs the same "create" action.

`createDiagram` itself stays plan-agnostic (the store shouldn't know about billing). Instead, each
call site checks `Object.keys(diagrams).length >= capabilities.diagramCap` (skipped entirely when
`diagramCap` is `null`, i.e. Pro) **before** invoking `createDiagram`, and if at cap, shows an upgrade
prompt (reuse `useUpgradeToastStore`, already used elsewhere for Pro upsells per
`store/useUpgradeToastStore.ts`) instead of creating the diagram.

The diagram-selector dropdown's "Create new diagram" item
([top-navbar.tsx:246-254](components/diagram-sections/top-navbar/top-navbar.tsx#L246-L254)) is
currently hidden entirely when `readOnly`. Since Free can now create diagrams (up to 5), change this
to: always show the item for a signed-in user, but disable it with a tooltip ("5/5 diagrams used —
upgrade to Pro for unlimited") once at cap, rather than hiding it outright.

### 5. Phase 3 — `/d` auto-create-and-redirect route (fixes gap #2 for real)

New file `app/(diagram)/d/page.tsx` — no visible UI, just a redirect effect:

```
1. Wait for store hydration (same useStoreHydration hook /d/[id] already uses).
2. Read useCanvasStore.getState().diagrams.
3. If empty: call createDiagram("Untitled Diagram") and router.replace(`/d/${newId}`).
4. If non-empty: router.replace(`/d/${mostRecentlyOpenedId}`)
   (need to confirm the store already tracks "last opened" — if not, fall back to
   the first key, which is an acceptable v1 heuristic).
5. While steps 1-4 resolve, show the same loading spinner /d/[id] shows during hydration.
```

Signed-in only — automatic via `proxy.ts`'s existing "everything under `/d/*` requires sign-in except
`/d/view`" rule, no middleware change needed.

This single route replaces the previous "landing page" concept entirely — see Open Questions 4-5.
The diagram-count cap check (§4) applies here too: this route only *creates* a diagram when the user
has zero, so the cap is never in play on first visit; it only matters for the "create new" action
inside `/d/[id]` itself.

### 6. Marketing copy reconciliation (`constants/pricing.tsx`)

- Free tier `note`/`features` bullets ([constants/pricing.tsx:13-25](constants/pricing.tsx#L13-L25)):
  replace "View only" framing with something like "Create up to 5 diagrams and edit via the DBML code
  editor" — add a bullet, remove/adjust "Read-only canvas & DBML view" (DBML is no longer read-only for
  Free; canvas still is).
- `ctaLink` — currently `"/w"`, which 404s today; update to whatever route Phase 3 actually builds
  (see Open Question 5).
- `pricingTable` rows: "Diagrams" → Free becomes "Up to 5" (was "View only");
  "Tables per diagram" → Free becomes "10" (was "20"); "Schema validation" and "Templates" rows both
  become "—" for Free (decided above).

### 7. Fixing gap #1 — diagram-owner-based Pro entitlement for editors

[convex/guards.ts:135-143](convex/guards.ts#L135-L143)'s `requireProDiagramEditor` currently checks
the *requesting collaborator's* plan:

```ts
export async function requireProDiagramEditor(ctx, diagramId) {
  const result = await requireDiagramEditor(ctx, diagramId);
  const plan = result.user.planId ? await ctx.db.get(result.user.planId) : null;
  requirePro(result.user, plan);   // ← wrong: checks the requester
  return { ...result, plan };
}
```

Change it to check the **diagram owner's** plan instead:

```ts
export async function requireProDiagramEditor(ctx, diagramId) {
  const result = await requireDiagramEditor(ctx, diagramId);
  const owner = await ctx.db.get(result.diagram.ownerId);
  const plan = owner?.planId ? await ctx.db.get(owner.planId) : null;
  requirePro(owner!, plan);
  return { ...result, plan };
}
```

Rationale: the pricing page already promises Pro "Team members: Up to 5" — the diagram is entitled by
the owner's subscription, the same way Figma/Notion/Linear scope billing to the file/workspace owner,
not to each individual collaborator. This makes the invite dialog's existing editor/admin role options
actually work, with no UI changes needed.

Deliberately **not** touching `requireProDiagramViewer` ([convex/guards.ts:125-133](convex/guards.ts#L125-L133)) —
its existing comment documents that version-history access is intentionally gated on the *requesting*
user's own plan (a personal feature add-on, not a diagram-level entitlement), which is a different and
still-correct model.

Consequence to confirm: if a diagram owner's subscription lapses, every collaborator (owner included)
loses edit rights on that diagram until it's renewed — consistent with how the app already blocks
other owner-downgrade scenarios, but worth confirming as the intended behavior.

This fix is fully independent of everything else in this plan (pure Convex-side change, no client
gating involved) and can ship on its own schedule.

### 8. Onboarding modal

A `Dialog` (reuse the existing `components/ui` dialog primitive, same one `MyDiagramsDialog` and the
"Create New Diagram" dialog already use) explaining: Code-tab-only editing, the 10-table/5-diagram
caps, and an upgrade CTA.

- **Trigger 1 — auto-show once.** On first mount of `/d/[id]` for a Free user, check a persisted flag
  (`localStorage` key, e.g. `dbluna:hasSeenFreeOnboarding`, or a small addition to an existing
  persisted store rather than a new one if `useCanvasStore`'s persist config is easy to extend —
  confirm at implementation time). If unset, open the modal and set the flag. Never re-triggers itself
  after that.
- **Trigger 2 — helper icon.** A small "?" / help icon added to `TopNavbar` (near the other icon
  buttons), always present for Free users, opens the same modal on demand regardless of the flag.
- **Always closable** — standard dialog dismiss (backdrop click, Esc, close button), never blocks
  canvas/code-tab interaction underneath.
- Default scope: **Free only** (Open Question 6). Pro users don't see the icon or the auto-show,
  unless you want a generic version later.

### 9. Clerk-hosted sign-up → `/d` redirect wiring

This codebase has no `ClerkProvider` at the app root and no custom `/sign-in`/`/sign-up` pages — the
`(diagram)` route group is the only place `ClerkProvider` is mounted
([app/(diagram)/layout.tsx](<app/(diagram)/layout.tsx>)), and `proxy.ts`'s public-route list includes
`/sign-in(.*)`/`/sign-up(.*)` defensively even though nothing renders at those paths today. In
practice, sign-up happens entirely on Clerk's hosted Account Portal, reached whenever
`auth.protect()` bounces an unauthenticated visitor there. Without extra wiring, a fresh sign-up would
land back wherever Clerk's dashboard-level default sends it (commonly the referring page, i.e.
marketing home) — not `/d`.

Two ways to close this, not mutually exclusive:

- **(a) Clerk Dashboard setting.** Set the "after sign-up" redirect URL for this application to
  `/d` in the Clerk Dashboard. Simplest, but it's an out-of-repo config change, not something this
  plan's file list can capture — needs to be done manually and noted as a deploy step, not a code diff.
- **(b) Explicit redirect param on every sign-up entry point.** Update the sign-up links this app
  actually renders — [components/marketing-general/footer.tsx:69](components/marketing-general/footer.tsx#L69)
  (`href="/sign-up"`) and the Free tier's `ctaLink` in `constants/pricing.tsx` — to include Clerk's
  redirect param (e.g. `/sign-up?redirect_url=/d`, exact param name depends on the Clerk SDK version
  in use — confirm against `@clerk/nextjs` docs at implementation time). This is a real code change,
  captured in the file list below, and works even if the Dashboard setting is misconfigured or reset.

Recommend doing **both** — (a) as the safety-net default for any sign-up entry point not explicitly
covered (e.g. Clerk's own hosted "sign in instead" links), (b) for the entry points this app controls
directly, so the behavior doesn't silently depend on a dashboard setting nobody remembers exists.

## File-by-file summary

| File | Change |
|---|---|
| `lib/plan-limits.ts` | **New.** `FREE_MAX_TABLES_PER_DIAGRAM`, `FREE_MAX_DIAGRAMS` constants. |
| `app/(diagram)/d/[id]/page.tsx` | Replace single `editingReadOnly` with a `capabilities` object; thread its fields to children instead of one flag. |
| `components/diagram-sections/canvas/canvas.tsx` (`CanvasStage`) | `readOnly` prop now driven by `!capabilities.canEditCanvas` (same value as before for both tiers — no behavior change, just where it's computed). |
| `components/diagram-general/code-editor.tsx` (and whatever DBML-apply hook it uses) | `readOnly` now `false` for Free too; add table-count-cap check before committing parsed DBML to the store, with inline error UX. |
| `components/diagram-general/dock-panel.tsx`, `dock-tabs-header.tsx` | Filter rendered tabs by `capabilities.visibleTabs`. |
| `components/diagram-sections/top-navbar/top-navbar.tsx` | Docs-mode toggle hidden for Free; "Create new diagram" item disabled-with-tooltip (not hidden) at cap, gated by diagram-count check before calling `createDiagram`. |
| `components/diagram-sections/toolbar.tsx` (`TabLauncherBar`) | No structural change — its existing `readOnly` prop now specifically means "canvas edit affordances," value unchanged for both tiers. |
| `store/useCanvasStore.tsx` | No change to `createDiagram` itself — cap check stays in the caller. |
| `convex/plans.ts` | Free plan `features.tablesPerDiagram` / add a `maxDiagrams` field, sourced from `lib/plan-limits.ts` (still unread by any query today, but now accurate — sets up future server-side enforcement if Free ever gets optional cloud backup). |
| `constants/pricing.tsx` | Copy updates per §6; `ctaLink` and Free-tier sign-up link updated per §9(b). |
| `convex/guards.ts` | `requireProDiagramEditor` checks the diagram owner's plan instead of the requester's; see §7. |
| `app/(diagram)/d/page.tsx` | **New.** Auto-create-and-redirect route, no visible UI; see §5. |
| New onboarding-modal component (e.g. `components/diagram-general/onboarding-modal.tsx`) | **New.** See §8. |
| `components/diagram-sections/top-navbar/top-navbar.tsx` (additional) | Add helper/"?" icon opening the onboarding modal, plus the first-mount auto-show check. |
| `components/marketing-general/footer.tsx` | Sign-up link (`href="/sign-up"`) gets the Clerk redirect param; see §9(b). |
| Clerk Dashboard (out-of-repo) | Set "after sign-up" redirect URL to `/d`; see §9(a). Deploy/config step, not a code diff. |

## Suggested phasing

0. **Phase 0** — the gap #1 fix (§7, `convex/guards.ts`). Fully independent of the rest; can ship
   first, standalone.
1. **Phase 1** — capability object + tab/canvas/docs-mode gating (§2), Code tab becomes editable for
   Free with no caps yet. Verifiable in isolation: Free can type DBML and see canvas update, nothing
   else is reachable.
2. **Phase 2** — table cap (§3) and diagram cap (§4) enforcement + upgrade prompts. Verifiable: hitting
   either cap blocks further creation with a clear message, existing over-cap data is untouched
   (Open Question 3).
3. **Phase 3** — `/d` auto-create-and-redirect route (§5). Verifiable: visiting `/d` with zero local
   diagrams lands you inside a brand-new one; visiting it with existing diagrams lands you inside one
   of them. No visible intermediate page.
4. **Phase 4** — onboarding modal (§8). Verifiable: first visit as Free shows it once, dismiss
   persists across reloads, helper icon reopens it on demand, never blocks the canvas/code tab.
5. **Phase 5** — Clerk-hosted sign-up redirect wiring (§9): Dashboard setting + redirect params on the
   footer and pricing sign-up links. Verifiable end-to-end: a brand-new sign-up lands in a freshly
   created diagram, not the marketing homepage.
6. **Phase 6** — marketing copy reconciliation (§6): pricing bullets/table rows, dead-link cleanup now
   that `ctaLink` resolves for real. Closes gap #2 completely.

## Testing checklist (manual, once implemented)

- Brand-new sign-up (real Clerk flow, not just navigating to `/d` manually): lands inside a freshly
  created diagram, not the marketing homepage and not a 404.
- Visiting `/d` directly with existing local diagrams: lands inside one of them, no intermediate page
  flash.
- Onboarding modal: appears once on a Free user's first `/d/[id]` visit, dismiss persists across a
  reload, helper icon reopens it anytime, closing it never blocks canvas/code-tab use.
- Free user on `/d/[id]`: Code tab visible and editable; Tables/Relationships/Notes/Areas/Issues/
  Templates/AI Chat tabs not present in the dock; Docs mode toggle absent; canvas visible but
  drag/click-to-add do nothing.
- Free user types DBML defining 11 tables: rejected with inline message, editor keeps their text,
  store unchanged.
- Free user at 5 diagrams: "Create new diagram" is disabled with an upgrade tooltip, not hidden.
- Free user who somehow has 12 tables already (pre-existing/downgraded): can still open and view the
  diagram; further table additions blocked until under 10 or upgraded.
- Pro user: no behavior change anywhere in this list.
- `/d/view` (anonymous share viewer): untouched, still fully read-only, unaffected by any of this.
- Pro owner invites a Free-plan collaborator as "editor": collaborator can now actually save edits
  (Phase 0 fix), where today they'd hit a silent `CONFLICT`/error on save.
