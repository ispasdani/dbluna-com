"use client";

import { useQuery } from "convex/react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PresenceAvatarsProps {
  cloudId: string | null | undefined;
}

const MAX_VISIBLE = 5;

function initials(firstName: string, lastName?: string) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function fullName(firstName: string, lastName?: string) {
  return `${firstName}${lastName ? ` ${lastName}` : ""}`;
}

// Who else is currently viewing this diagram (release-1-0/collaboration-plan.md
// Phase B §4) — purely a presence signal, no live cursors. Renders nothing for
// local-only diagrams or when you're the only one here.
export function PresenceAvatars({ cloudId }: PresenceAvatarsProps) {
  const active = useQuery(
    api.diagramPresence.listActive,
    cloudId ? { diagramId: cloudId as Id<"diagrams"> } : "skip"
  );

  // You're represented by the UserButton at the end of the navbar, so showing
  // yourself here too would be a duplicate — and it's what made a solo user on
  // a cloud diagram see a stack of exactly one (themselves).
  const others = active?.filter((member) => !member.isSelf) ?? [];

  if (!cloudId || others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.slice(MAX_VISIBLE);

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((member) => (
        <HoverCard key={member.userId} openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-primary text-[10px] font-semibold text-primary-foreground">
              {member.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small, dynamic Clerk avatar; not worth next/image's remote-pattern config for this
                <img src={member.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(member.firstName, member.lastName)
              )}
            </div>
          </HoverCardTrigger>
          {/* w-auto overrides hover-card.tsx's default w-64, which is far too
              wide for a name over an email. */}
          <HoverCardContent align="end" className="w-auto max-w-64 p-2.5">
            <p className="text-sm font-medium leading-tight">
              {fullName(member.firstName, member.lastName)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </HoverCardContent>
        </HoverCard>
      ))}
      {overflow.length > 0 && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
              +{overflow.length}
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-auto max-w-64 p-2.5">
            <ul className="space-y-1.5">
              {overflow.map((member) => (
                <li key={member.userId}>
                  <p className="text-sm font-medium leading-tight">
                    {fullName(member.firstName, member.lastName)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </li>
              ))}
            </ul>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
}
