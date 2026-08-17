# Member Management — Implementation Plan

Covers the navbar identity work (shipped) and member management (planned): seeing who has
access to a diagram, removing them, changing their role, and what happens to everyone when
the owner deletes.

Extends [release-1-0/collaboration-plan.md](release-1-0/collaboration-plan.md) Phase A/B, which
built invites and presence but stopped short of ever *removing* anyone.

## Context

Collaboration shipped with a one-way door. `diagramInvites.create` and `accept` insert
`diagramMembers` rows; nothing in the codebase ever deletes one. Every `diagramMembers`
reference in `convex/` is an insert or a read — there is no `db.delete` against that table
anywhere.

That is not merely a missing feature. It produces two deadlocks where the code instructs the
user to do something the app makes impossible:

1. **The diagram becomes undeletable.** [convex/diagrams.ts:396](convex/diagrams.ts) refuses to
   delete when `allMembers.length > 1` (the owner holds a member row of their own, inserted at
   [convex/diagrams.ts:125](convex/diagrams.ts), hence `> 1`). Its error reads *"Remove all
   collaborators before deleting or disconnecting this diagram from the cloud."* There is no way
   to remove a collaborator. So the moment one person accepts an invite, the owner can never
   delete that diagram — and never disconnect it back to local-only, since
   [hooks/use-cloud-sync.ts:81](hooks/use-cloud-sync.ts)'s `makeLocalOnly` routes through the
   same mutation.
2. **Seats exhaust permanently.** `MAX_MEMBERS = 5`, counted as members + active pending invites
   ([convex/diagramInvites.ts:42](convex/diagramInvites.ts)). Accepted members hold seats forever,
   so after five you can never invite anyone to that diagram again. That error also says *"remove
   one before inviting another."* Same impossibility.

Plus the ordinary case: someone leaves the team and keeps editor access indefinitely.

## Current state

**Shipped in this pass (Phases 1–2):**

- `components/diagram-sections/top-navbar/user-menu.tsx` — Clerk `UserButton` in a new right-hand
  cluster of the navbar, with a plan-aware "Manage plan" / "Upgrade to Pro" row. Prior to this the
  app had no sign-out affordance at all: `UserButton`, `SignedIn`, `SignedOut` and `SignOutButton`
  appeared in zero files.
- `afterSignOutUrl="/"` on the diagram layout's `ClerkProvider`. It is deprecated on `<UserButton>`
  in `@clerk/nextjs` 6.36. Without it, signing out from `/d/[id]` re-enters `proxy.ts`'s
  `auth.protect()` and bounces to Clerk's hosted sign-in, which reads as a crash.
- `diagramPresence.listActive` now returns `email` and `isSelf`; `presence-avatars.tsx` drops the
  caller from the stack and shows name + email in a `HoverCard`. This also fixed a latent bug where
  a solo user on a cloud diagram saw a one-avatar stack of themselves.

**Not built:**

- No way to remove an accepted member, or change their role.
- No way to *see* an accepted member. `diagramInvites.listForDiagram` filters on `!i.usedAt`
  ([convex/diagramInvites.ts:86](convex/diagramInvites.ts)), so on acceptance a person vanishes
  from the pending list and appears nowhere else unless they happen to be online right now.
- The `admin` role exists in the schema and in every guard, but is unreachable — the invite dialog
  offers only editor and viewer ([invite-dialog.tsx:170](components/diagram-sections/top-navbar/invite-dialog.tsx)).
  In practice member management is owner-only today.

## Constraint: pending invitees have no avatar

The roster wants to show invited-but-not-accepted people. They cannot have an avatar, and this is
not a gap to be filled — it is inherent. `diagramInvites`
([convex/schema.ts:165](convex/schema.ts)) stores `invitedEmail`, `role`, `token` and no `userId`,
because you invite an email address and that person may not have an account yet.

Three display states, not two:

| State | Data available | Source |
|---|---|---|
| Online now | name, avatar, email | `diagramPresence` + `users` |
| Member, offline | name, avatar, email | `diagramMembers` + `users` |
| Invited, not accepted | **email only** | `diagramInvites` |

**Decision: the roster subsumes presence rather than replacing it.** The component currently
answers *"who is here this second"* (30s staleness window). The roster answers *"who has access"*.
Live presence is kept as a decoration on the roster — full colour + ring for online, dimmed for
offline, dashed outline for pending — rather than discarded. Dropping it would lose the "someone
else is editing right now" signal, which is the thing that warns you before you collide with
another editor, and the entire point of collaboration-plan Phase B §4.

## Plan

### 1. New `convex/diagramMembers.ts`

- `list({ diagramId })` — accepted members joined to `users`, plus pending invites (email + role
  only), returned as one array with a `status` discriminator so the client renders a single
  ordered roster. Guard: `requireDiagramViewer`.
- `remove({ memberId })` — guard `requireDiagramOwnerOrAdmin`. The owner's row is never removable.
- `changeRole({ memberId, role })` — same guard. The owner is never demotable.
- Admins may not remove or demote other admins; only the owner can. Prevents two admins deadlocking
  each other, and prevents an admin locking out the owner.

### 2. Split the delete path in `convex/diagrams.ts`

`deleteDiagram` currently serves two callers with opposite intent: real deletion (My Diagrams) and
"make this local-only" ([hooks/use-cloud-sync.ts:81](hooks/use-cloud-sync.ts)). Cascading on
deletion is expected; cascading on disconnect would silently kick everyone off an action that
sounds harmless. They split:

- `deleteDiagram` — cascades. Hard-deletes `diagramMembers`, `diagramInvites` and
  `diagramPresence` rows so access dies immediately; soft-deletes the diagram itself
  (`isDeleted: true`, as today); leaves `diagramVersions` attached so an undelete remains possible.
  The `allMembers.length > 1` block is removed.
- `disconnectFromCloud` — new, keeps the existing `allMembers.length > 1` guard. `makeLocalOnly`
  points here instead.

The removed guard exists deliberately — the comment at
[convex/diagrams.ts:389](convex/diagrams.ts) says it is there so *"a collaborator's access [isn't]
silently cut off with no warning to anyone."* Cascading reverses that decision knowingly. The
warning does not disappear; it moves into a confirm dialog (§3).

### 3. Client

- **Roster** — `presence-avatars.tsx` grows into the roster described above, keeping the Phase 2
  hover card (name over email; email initial only, for pending).
- **Avatar click → dropdown.** Member: change role / remove. Pending: copy invite link / revoke
  (reusing the existing `diagramInvites.revoke`). Items render only for owner/admin, gated on
  `diagrams.getMyRole` ([convex/diagrams.ts:181](convex/diagrams.ts), already exists).
- **`admin` added to the invite role picker**, making the role reachable and the "admins manage
  members" model real.
- **Confirm dialog on delete**, naming the collaborator count — "3 collaborators will lose access
  to this diagram" — replacing the guard that used to block it outright.
- **`clearDiagramCloudLink` on a null remote** in `use-cloud-reconciliation.ts` (see below).

### 4. What a removed collaborator keeps

**Decision: they keep their local copy.** The app is local-first; losing cloud access should not
destroy their work.

This is mostly free. [hooks/use-cloud-reconciliation.ts:61](hooks/use-cloud-reconciliation.ts)
already bails on a null remote — `"no access, or the diagram is gone — nothing to merge"` — and
under the cascade their member row vanishes, so `diagrams.get` returns null
([convex/diagrams.ts:172](convex/diagrams.ts)) and reconciliation leaves their local data
untouched.

The loose end: their diagram stays flagged `storage: "cloud"` with a dangling `cloudId`, so
`useCloudAutoSave` keeps pushing to something they can no longer access, failing silently forever.
Reconciliation must call `clearDiagramCloudLink` when the remote goes null for a diagram that
previously resolved, flipping it back to local-only.

## Decisions made

| Question | Decision |
|---|---|
| Collaborator's copy on owner delete | They keep their local copy as a local-only diagram |
| Should disconnect cascade too | No — split into two mutations, only real deletion cascades |
| Expose the `admin` role | Yes, add it to the invite role picker |
| Roster vs. presence | Roster subsumes presence; live state becomes a decoration |
| Pending invitees in the roster | Yes, email-initial only — no avatar is possible |
| Who can add/remove/change role | Owner and admin only (already true for invite create/revoke) |

## Critical files

- new `convex/diagramMembers.ts`
- `convex/diagrams.ts` — split `deleteDiagram`, add `disconnectFromCloud`
- `convex/diagramPresence.ts` — `listActive` feeds the roster's online state
- `components/diagram-sections/top-navbar/presence-avatars.tsx` — becomes the roster
- `components/diagram-sections/top-navbar/invite-dialog.tsx` — `admin` in the role picker
- `hooks/use-cloud-sync.ts` — `makeLocalOnly` retargeted to `disconnectFromCloud`
- `hooks/use-cloud-reconciliation.ts` — clear the cloud link on a null remote

## Risk

This touches the delete path, the one place in the app where a bug loses real data. The cascade
split warrants careful review before it ships — in particular that `makeLocalOnly` is retargeted
in the same change, since leaving it pointed at the now-cascading `deleteDiagram` would turn
"make local-only" into "silently remove every collaborator".

## Verification

Requires two accounts on a cloud-synced diagram; none of the member flows are observable solo.
Typecheck, lint and the Convex push are the only checks available without a second login.

1. Owner invites a second account — a dashed, email-only avatar appears in the roster immediately,
   before acceptance.
2. Second account accepts — the avatar fills in with their name and picture, dimmed while they are
   not on the diagram, full colour within ~10s of them opening it (the heartbeat interval).
3. Owner clicks the avatar → changes role to viewer → the second account loses edit affordances.
4. Owner clicks the avatar → removes them → the second account loses access, and their local copy
   survives as a local-only diagram that no longer attempts to sync.
5. A non-admin editor clicking an avatar sees no remove/role options.
6. Owner deletes a diagram with collaborators — the confirm dialog names the count; afterwards
   every member, invite and presence row for that diagram is gone.
7. Owner disconnects a diagram with collaborators — still blocked, with the existing message.
8. Invite five people, remove one, invite another — succeeds, confirming seats are reclaimed.
