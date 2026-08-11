"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Link as LinkIcon, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useCloudSync } from "@/hooks/use-cloud-sync";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
}

type InviteRole = "editor" | "viewer";

// Separate from ShareDialog on purpose (release-1-0/collaboration-plan.md
// Phase A §2): ShareDialog produces an anonymous, read-only, no-account link.
// This produces a link that, once opened by a signed-in user whose email
// matches, grants real diagramMembers access.
export function InviteDialog({ open, onOpenChange, localId }: InviteDialogProps) {
  const diagram = useCanvasStore((s) => (localId ? s.diagrams[localId] : undefined));
  const { storage, isBusy: isSyncing, saveToCloud } = useCloudSync(localId ?? "");

  const [invitedEmail, setInvitedEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cloudId = diagram?.cloudId as Id<"diagrams"> | null | undefined;
  const createInvite = useMutation(api.diagramInvites.create);
  const revokeInvite = useMutation(api.diagramInvites.revoke);
  const pendingInvites = useQuery(
    api.diagramInvites.listForDiagram,
    cloudId ? { diagramId: cloudId } : "skip"
  );

  const reset = () => {
    setInvitedEmail("");
    setRole("editor");
    setCreatedLink(null);
    setErrorMessage(null);
    setCopiedToken(null);
  };

  const handleSyncToCloud = async () => {
    await saveToCloud();
  };

  const handleCreateInvite = async () => {
    if (!cloudId || !invitedEmail.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await createInvite({
        diagramId: cloudId,
        invitedEmail: invitedEmail.trim(),
        role,
      });
      const link = `${window.location.origin}/d/join?token=${result.token}`;
      setCreatedLink(link);
      await navigator.clipboard.writeText(link);
      setInvitedEmail("");
    } catch (err) {
      setErrorMessage(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Couldn't create the invite — please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/d/join?token=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (inviteId: Id<"diagramInvites">) => {
    await revokeInvite({ inviteId });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Invite a collaborator</DialogTitle>
        </DialogHeader>

        {!diagram ? null : storage === "local" ? (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Inviting someone syncs <span className="font-medium text-foreground">{diagram.name}</span>{" "}
              to the cloud so they can access it. You can still keep it local-only if you invite no one.
            </p>
            <Button onClick={handleSyncToCloud} disabled={isSyncing} className="gap-2">
              {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
              Sync to cloud & continue
            </Button>
          </div>
        ) : (
          <div className="py-2 space-y-4">
            {createdLink ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Invite link created and copied — send it to the person you invited.
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                  {createdLink}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCreatedLink(null)}>
                  Invite someone else
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="invite-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={invitedEmail}
                    onChange={(e) => setInvitedEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className="mt-2"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateInvite()}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor — can make changes</SelectItem>
                      <SelectItem value="viewer">Viewer — read only</SelectItem>
                    </SelectContent>
                  </Select>
                  {role === "editor" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      They&apos;ll need their own Pro plan to actually edit — Free accounts can view.
                    </p>
                  )}
                </div>
                {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
              </div>
            )}

            {pendingInvites && pendingInvites.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Pending invites</p>
                <ul className="space-y-1.5">
                  {pendingInvites.map((invite) => (
                    <li
                      key={invite._id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">
                        {invite.invitedEmail}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({invite.role}
                          {invite.isExpired ? ", expired" : ""})
                        </span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopyLink(invite.token)}
                          title="Copy invite link"
                        >
                          {copiedToken === invite.token ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <LinkIcon className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRevoke(invite._id)}
                          title="Revoke invite"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {diagram && storage === "cloud" && !createdLink && (
          <DialogFooter>
            <Button
              onClick={handleCreateInvite}
              disabled={!invitedEmail.trim() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Create invite link
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
