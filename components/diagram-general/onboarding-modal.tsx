"use client";

import Link from "next/link";
import { Code, MousePointer2, Sparkles, LayoutGrid, FileText, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useCapabilities } from "./capabilities-context";
import { FREE_MAX_TABLES_PER_DIAGRAM, FREE_MAX_DIAGRAMS } from "@/lib/plan-limits";

function Row({ icon: Icon, children }: { icon: typeof Code; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

// Onboarding / product-tour modal. Never blocks the editor — always closable
// (backdrop, Esc, button). Auto-shows once per browser (see the first-mount
// effect in app/(diagram)/d/[id]/page.tsx); the TopNavbar help icon reopens it
// anytime. Content differs by plan. See free-tier-code-only-editing-plan.md §8.
export function OnboardingModal() {
  const { isOpen, close } = useOnboardingStore();
  const { isPro } = useCapabilities();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {isPro ? "Welcome to dbluna" : "How the Free plan works"}
          </DialogTitle>
          <DialogDescription>
            {isPro
              ? "A quick tour of what you can do here."
              : "You can build real schemas on Free — with a couple of limits."}
          </DialogDescription>
        </DialogHeader>

        {isPro ? (
          <ul className="flex flex-col gap-3 py-2">
            <Row icon={Code}>
              Design in the visual canvas or the DBML <strong>Code</strong> tab — they stay in sync
              two ways.
            </Row>
            <Row icon={LayoutGrid}>
              The dock tabs cover Tables, Relationships, Issues, Templates, Notes, Areas and AI Chat.
            </Row>
            <Row icon={FileText}>
              <strong>DBML Docs</strong> mode turns your schema into a browsable documentation view.
            </Row>
            <Row icon={Users}>
              Invite teammates, share no-account links, and sync to the cloud from the top bar.
            </Row>
          </ul>
        ) : (
          <ul className="flex flex-col gap-3 py-2">
            <Row icon={Code}>
              Edit your schema in the <strong>Code</strong> tab — tables, columns, and relationships
              (via <code className="text-xs">Ref:</code> lines), all in DBML.
            </Row>
            <Row icon={MousePointer2}>
              The visual canvas is <strong>view-only</strong> on Free — pan and zoom to see what your
              code produces.
            </Row>
            <Row icon={LayoutGrid}>
              Up to <strong>{FREE_MAX_TABLES_PER_DIAGRAM} tables</strong> per diagram and{" "}
              <strong>{FREE_MAX_DIAGRAMS} diagrams</strong> total.
            </Row>
            <Row icon={Sparkles}>
              Pro unlocks the full visual editor, unlimited tables and diagrams, cloud sync, imports,
              and more.
            </Row>
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!isPro && (
            <Button asChild variant="default">
              <Link href="/pricing" onClick={close}>
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          )}
          <Button variant={isPro ? "default" : "outline"} onClick={close}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
