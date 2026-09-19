"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertCircle, Check, CheckCircle2, Cloud, Copy, Eye, Loader2, Pencil, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { cn } from "@/lib/utils";
import styles from "./small-dialog.module.scss";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string | null;
}

type InviteRole = "editor" | "viewer";

const ROLES: { id: InviteRole; label: string; hint: string; icon: typeof Pencil }[] = [
  { id: "editor", label: "Editor", hint: "Can make changes", icon: Pencil },
  { id: "viewer", label: "Viewer", hint: "Can only look", icon: Eye },
];

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
  const [linkCopied, setLinkCopied] = useState(false);
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
    setLinkCopied(false);
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
      setLinkCopied(true);
      setInvitedEmail("");
    } catch (err) {
      setErrorMessage(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : "Couldn't create the invite. Try again."
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

  const handleCopyCreated = async () => {
    if (!createdLink) return;
    await navigator.clipboard.writeText(createdLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleRevoke = async (inviteId: Id<"diagramInvites">) => {
    await revokeInvite({ inviteId });
  };

  const isCloud = !!diagram && storage === "cloud";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className={cn(styles.content, styles.medium)}>
        <DialogHeader className={styles.header}>
          <span className={styles.badge}>
            <UserPlus className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className={styles.title}>Invite a collaborator</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              {diagram ? <b>{diagram.name}</b> : "Work on this diagram together"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {!diagram ? null : storage === "local" ? (
          <>
            <div className={styles.body}>
              <div className={styles.gate}>
                <span className={styles.gateIcon}>
                  <Cloud className="size-5" />
                </span>
                <span className={styles.gateTitle}>Sync to the cloud first</span>
                <p>
                  Inviting someone syncs <b>{diagram.name}</b> to the cloud so they can open it. If you invite no one,
                  you can keep it on this device only.
                </p>
              </div>
            </div>
            <div className={styles.foot}>
              <span className={styles.spacer} />
              <button type="button" className={styles.primary} onClick={handleSyncToCloud} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                Sync to cloud and continue
              </button>
            </div>
          </>
        ) : (
          <div className={styles.body}>
            {createdLink ? (
              <>
                <div className={cn(styles.note, styles.noteOk)}>
                  <CheckCircle2 className="size-4" />
                  <span>Invite created and the link is copied. Send it to the person you invited.</span>
                </div>
                <div className={styles.linkBox}>
                  <code title={createdLink}>{createdLink}</code>
                  <button type="button" className={cn(styles.secondary, styles.small)} onClick={handleCopyCreated}>
                    {linkCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {linkCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <Input
                    type="email"
                    value={invitedEmail}
                    onChange={(e) => setInvitedEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className={styles.input}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateInvite()}
                    autoFocus
                  />
                </label>

                <div className={styles.field}>
                  <span className={styles.label}>Role</span>
                  <div className={styles.roles} role="radiogroup" aria-label="Role">
                    {ROLES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={role === r.id}
                        className={styles.role}
                        onClick={() => setRole(r.id)}
                      >
                        <span className={styles.roleHead}>
                          <r.icon className="size-3.5" />
                          {r.label}
                        </span>
                        <small>{r.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {role === "editor" && (
                  <div className={cn(styles.note, styles.noteInfo)}>
                    <AlertCircle className="size-4" />
                    <span>Editing needs their own Pro plan. On a Free plan they can view.</span>
                  </div>
                )}
                {errorMessage && (
                  <div className={cn(styles.note, styles.noteError)} role="alert">
                    <AlertCircle className="size-4" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </>
            )}

            {pendingInvites && pendingInvites.length > 0 && (
              <div className={styles.field}>
                <span className={styles.label}>Pending invites · {pendingInvites.length}</span>
                <ul className={styles.people}>
                  {pendingInvites.map((invite) => (
                    <li key={invite._id} className={styles.person}>
                      <span className={styles.avatar} aria-hidden>
                        {invite.invitedEmail.charAt(0)}
                      </span>
                      <span className={styles.personText}>
                        <span title={invite.invitedEmail}>{invite.invitedEmail}</span>
                        <small>
                          <span className={cn(styles.tag, invite.role === "editor" && styles.tagAccent)}>
                            {invite.role === "editor" ? "Editor" : "Viewer"}
                          </span>
                          {invite.isExpired && <span className={cn(styles.tag, styles.tagWarn)}>Expired</span>}
                        </small>
                      </span>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleCopyLink(invite.token)}
                        title="Copy invite link"
                        aria-label={`Copy invite link for ${invite.invitedEmail}`}
                      >
                        {copiedToken === invite.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </button>
                      <button
                        type="button"
                        className={cn(styles.iconBtn, styles.iconDanger)}
                        onClick={() => handleRevoke(invite._id)}
                        title="Revoke invite"
                        aria-label={`Revoke invite for ${invite.invitedEmail}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {isCloud && (
          <div className={styles.foot}>
            {createdLink ? (
              <>
                <span className={styles.spacer} />
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    setCreatedLink(null);
                    setLinkCopied(false);
                  }}
                >
                  <UserPlus className="size-4" />
                  Invite someone else
                </button>
              </>
            ) : (
              <>
                <span className={styles.footInfo}>They&apos;ll get access once they sign in with this email.</span>
                <span className={styles.spacer} />
                <button
                  type="button"
                  className={styles.primary}
                  onClick={handleCreateInvite}
                  disabled={!invitedEmail.trim() || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Create invite link
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
