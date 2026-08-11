"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PresenceAvatarsProps {
  cloudId: string | null | undefined;
}

const MAX_VISIBLE = 5;

function initials(firstName: string, lastName?: string) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

// Who's currently viewing this diagram (release-1-0/collaboration-plan.md
// Phase B §4) — purely a presence signal, no live cursors. Renders nothing
// for local-only diagrams or when no one else is here.
export function PresenceAvatars({ cloudId }: PresenceAvatarsProps) {
  const active = useQuery(
    api.diagramPresence.listActive,
    cloudId ? { diagramId: cloudId as Id<"diagrams"> } : "skip"
  );

  if (!cloudId || !active || active.length === 0) return null;

  const visible = active.slice(0, MAX_VISIBLE);
  const overflow = active.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((member) => (
        <div
          key={member.userId}
          title={`${member.firstName}${member.lastName ? ` ${member.lastName}` : ""}`}
          className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary text-[10px] font-semibold text-primary-foreground"
        >
          {member.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small, dynamic Clerk avatar; not worth next/image's remote-pattern config for this
            <img src={member.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(member.firstName, member.lastName)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
