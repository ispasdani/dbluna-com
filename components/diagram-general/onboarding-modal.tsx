"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownUp,
  BookOpen,
  Check,
  CircleHelp,
  Cloud,
  Code,
  Compass,
  Database,
  Download,
  Eye,
  FileText,
  Focus,
  History,
  Keyboard,
  LayoutTemplate,
  Link as LinkIcon,
  ListOrdered,
  Lock,
  MousePointer2,
  Move,
  PanelLeft,
  Palette,
  Plus,
  Share2,
  Sparkles,
  Square,
  StickyNote,
  Table,
  Upload,
  UserPlus,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useCapabilities } from "./capabilities-context";
import { FREE_MAX_TABLES_PER_DIAGRAM, FREE_MAX_DIAGRAMS } from "@/lib/plan-limits";
import { SHORTCUT_GROUPS } from "@/components/diagram-sections/canvas/canvas-shortcuts-help";
import { cn } from "@/lib/utils";
import styles from "./onboarding-modal.module.scss";

type Section = "start" | "canvas" | "panels" | "code" | "io" | "team" | "keys" | "plan";

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "start", label: "Getting started", icon: Compass },
  { id: "canvas", label: "Canvas", icon: MousePointer2 },
  { id: "panels", label: "Side panels", icon: PanelLeft },
  { id: "code", label: "Code", icon: Code },
  { id: "io", label: "Import and export", icon: ArrowDownUp },
  { id: "team", label: "Sharing and teamwork", icon: Users },
  { id: "keys", label: "Shortcuts", icon: Keyboard },
  { id: "plan", label: "Your plan", icon: Sparkles },
];

/** One feature: icon, name, and a line or two. `pro` dims it and tags it on Free. */
function Row({
  icon: Icon,
  title,
  pro,
  isPro,
  children,
}: {
  icon: LucideIcon;
  title: string;
  pro?: boolean;
  isPro: boolean;
  children: React.ReactNode;
}) {
  const locked = pro && !isPro;
  return (
    <li className={cn(styles.row, locked && styles.locked)}>
      <span className={styles.rowIcon}>
        <Icon className="size-4" />
      </span>
      <span className={styles.rowText}>
        <span style={{ color: "var(--foreground)", fontWeight: 500 }}>
          {title}
          {locked && <span className={styles.proTag}>Pro</span>}
        </span>
        <span>{children}</span>
      </span>
    </li>
  );
}

function PageHead({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

// Onboarding / help modal. Never blocks the editor — always closable
// (backdrop, Esc, button). Auto-shows once per browser (see the first-mount
// effect in app/(diagram)/d/[id]/page.tsx); the TopNavbar help icon reopens it
// anytime. The first page differs by plan; Pro-only features are tagged on
// Free. See free-tier-code-only-editing-plan.md §8.
export function OnboardingModal() {
  const { isOpen, close } = useOnboardingStore();
  const { isPro } = useCapabilities();
  const [section, setSection] = useState<Section>("start");

  const rowProps = { isPro };

  let page: React.ReactNode;
  switch (section) {
    case "start":
      page = isPro ? (
        <>
          <PageHead title="Welcome to dbluna">
            Design a database visually or as code. Both views stay in sync, so use whichever is faster for the job.
          </PageHead>
          <div className={styles.group}>
            <span className={styles.label}>First steps</span>
            <ol className={styles.steps}>
              <li className={styles.stepItem}>
                <span>
                  Add a table with the <b>Add table</b> button in the canvas toolbar, or start from a ready-made schema in the{" "}
                  <b>Templates</b> tab.
                </span>
              </li>
              <li className={styles.stepItem}>
                <span>
                  Connect two tables by dragging from a column&apos;s handle (the dot on the edge of the row) onto a
                  column of another table.
                </span>
              </li>
              <li className={styles.stepItem}>
                <span>
                  Check the <b>Issues</b> tab for missing keys, naming problems and type mismatches.
                </span>
              </li>
              <li className={styles.stepItem}>
                <span>
                  Share, invite teammates or export SQL from the buttons in the top bar.
                </span>
              </li>
            </ol>
          </div>
          <div className={styles.group}>
            <span className={styles.label}>Good to know</span>
            <ul className={styles.rows}>
              <Row icon={Database} title="One diagram is one database" {...rowProps}>
                Schemas are a prefix on table names, like <b>dbo.Users</b>. Manage them in the Database tab.
              </Row>
              <Row icon={Cloud} title="Saved as you go" {...rowProps}>
                Diagrams save in this browser automatically. Save one to the cloud to open it on other devices and
                work on it with others.
              </Row>
            </ul>
          </div>
        </>
      ) : (
        <>
          <PageHead title="How the Free plan works">
            You can build real schemas on Free. You write them as code, and the canvas draws them.
          </PageHead>
          <div className={styles.group}>
            <span className={styles.label}>First steps</span>
            <ol className={styles.steps}>
              <li className={styles.stepItem}>
                <span>
                  Open the <b>Code</b> tab and write tables in DBML, for example{" "}
                  <b>Table users {"{"} id int [pk] {"}"}</b>.
                </span>
              </li>
              <li className={styles.stepItem}>
                <span>
                  Link tables with <b>Ref:</b> lines. The canvas draws each relationship as you type.
                </span>
              </li>
              <li className={styles.stepItem}>
                <span>Pan and zoom the canvas to check the result. On Free the canvas is view-only.</span>
              </li>
            </ol>
          </div>
          <div className={styles.group}>
            <span className={styles.label}>Limits</span>
            <ul className={styles.rows}>
              <Row icon={Table} title={`Up to ${FREE_MAX_TABLES_PER_DIAGRAM} tables per diagram`} {...rowProps}>
                The Code tab tells you when a change would go over, and keeps your text so nothing is lost.
              </Row>
              <Row icon={LayoutTemplate} title={`Up to ${FREE_MAX_DIAGRAMS} diagrams`} {...rowProps}>
                The My diagrams list shows how many you&apos;ve used.
              </Row>
            </ul>
          </div>
        </>
      );
      break;

    case "canvas":
      page = (
        <>
          <PageHead title="Canvas">
            Your tables, relationships, notes and areas, laid out freely. Everything here is also listed in the side
            panels.
          </PageHead>
          <ul className={styles.rows}>
            <Row icon={Plus} title="Add things" pro {...rowProps}>
              The floating toolbar adds a <b>table</b>, a <b>note</b> for comments, or an <b>area</b> to frame a group
              of tables.
            </Row>
            <Row icon={LinkIcon} title="Connect tables" pro {...rowProps}>
              Hover a column to see its handles, then drag from one onto a column in another table. Click a line to
              select it; its details open in the Relationships tab.
            </Row>
            <Row icon={Move} title="Move and select" {...rowProps}>
              Drag a table to move it. Drag on empty space to select several; hold Shift to add to the selection.
            </Row>
            <Row icon={Lock} title="Lock and recolor" pro {...rowProps}>
              Hover a table&apos;s header for its lock and its menu, which changes the color or deletes it.
            </Row>
            <Row icon={Eye} title="Follow a relationship" {...rowProps}>
              Hover a table or a line to highlight what it&apos;s connected to.
            </Row>
            <Row icon={Palette} title="Change the look" {...rowProps}>
              The <b>Style</b> menu offers four canvas styles: Recommended, Expressive, Compact and Bold.
            </Row>
            <Row icon={Focus} title="View options" {...rowProps}>
              The <b>View</b> menu turns on snap to grid and focus mode, switches between a grid and a dotted
              background, and hides the dock or top bar.
            </Row>
            <Row icon={Wand2} title="Luna AI" pro {...rowProps}>
              The wand button at the bottom right of the canvas opens an assistant that can build and change your
              schema from plain language.
            </Row>
          </ul>
        </>
      );
      break;

    case "panels":
      page = (
        <>
          <PageHead title="Side panels">
            The dock next to the canvas holds tabs for every part of the schema. Show or hide them from the{" "}
            <b>Tabs</b> menu, and give each its own look under <b>Style</b>.
          </PageHead>
          <ul className={styles.rows}>
            <Row icon={Table} title="Tables" pro {...rowProps}>
              Every table as a card. Open one to edit its columns, schema, color and comment.
            </Row>
            <Row icon={LinkIcon} title="Relationships" pro {...rowProps}>
              Grouped by table. Open one to see both tables, the cardinality, and what happens on delete or update.
            </Row>
            <Row icon={AlertCircle} title="Issues" pro {...rowProps}>
              Checks names, keys, types and relationships as you work. Click an issue to jump to it.
            </Row>
            <Row icon={Database} title="Database" pro {...rowProps}>
              The project name, database type and overview note, plus the list of schemas.
            </Row>
            <Row icon={ListOrdered} title="Enums" pro {...rowProps}>
              Named sets of values, like order statuses, that you can use as a column type.
            </Row>
            <Row icon={StickyNote} title="Notes" pro {...rowProps}>
              Sticky notes on the canvas for decisions and open questions.
            </Row>
            <Row icon={Square} title="Areas" pro {...rowProps}>
              Frames that group tables, like a module. Each shows which tables sit inside it.
            </Row>
            <Row icon={LayoutTemplate} title="Templates" pro {...rowProps}>
              Ready-made schemas to start from, added next to what you already have.
            </Row>
            <Row icon={Code} title="Code" {...rowProps}>
              The whole schema as text. See the next section.
            </Row>
          </ul>
        </>
      );
      break;

    case "code":
      page = (
        <>
          <PageHead title="Code">
            The Code tab shows the schema as DBML. Edits here update the canvas, and canvas edits update the code.
          </PageHead>
          <ul className={styles.rows}>
            <Row icon={Code} title="DBML" {...rowProps}>
              Tables, columns, <b>Ref:</b> relationships, enums, table groups and the project note. Changes reach the
              canvas a moment after you stop typing.
            </Row>
            <Row icon={FileText} title="JSON and Mermaid" {...rowProps}>
              Switch formats with the tabs at the top. Mermaid is export-only: edits there don&apos;t reach the canvas.
            </Row>
            <Row icon={Check} title="Status bar" {...rowProps}>
              Says whether the canvas is in sync, paused by problems, or read-only. Problems are listed with their line;
              click one to jump there.
            </Row>
            <Row icon={Palette} title="Table colors and font" {...rowProps}>
              Each table name shows its canvas color. The code font is Inter by default; switch to monospace under{" "}
              <b>Style</b>.
            </Row>
            <Row icon={Download} title="Copy and download" pro {...rowProps}>
              The buttons at the top right copy the code or save it as a file.
            </Row>
          </ul>
        </>
      );
      break;

    case "io":
      page = (
        <>
          <PageHead title="Import and export">
            Bring an existing database in, or take your schema out, from the <b>Import</b> and <b>Export</b> menus in
            the top bar.
          </PageHead>
          <div className={styles.group}>
            <span className={styles.label}>Import</span>
            <ul className={styles.rows}>
              <Row icon={Database} title="From a live database" pro {...rowProps}>
                Connect to PostgreSQL or SQL Server and read its tables and foreign keys.
              </Row>
              <Row icon={Upload} title="From a SQL script" pro {...rowProps}>
                Paste CREATE TABLE statements or drop a .sql file, review what was found, untick what you don&apos;t
                need, then import.
              </Row>
              <Row icon={FileText} title="From a file" pro {...rowProps}>
                A dbluna JSON export, CSV files (one table each), or a SQL Server BACPAC.
              </Row>
            </ul>
          </div>
          <div className={styles.group}>
            <span className={styles.label}>Export</span>
            <ul className={styles.rows}>
              <Row icon={Download} title="Schema" pro {...rowProps}>
                JSON (the whole diagram), DBML, or a SQL script for PostgreSQL, MySQL, SQL Server or Oracle.
              </Row>
              <Row icon={FileText} title="Image" pro {...rowProps}>
                An SVG picture of the canvas, sharp at any size.
              </Row>
              <Row icon={BookOpen} title="DBML Docs" pro {...rowProps}>
                The <b>DBML Docs</b> button turns the schema into browsable documentation.
              </Row>
            </ul>
          </div>
        </>
      );
      break;

    case "team":
      page = (
        <>
          <PageHead title="Sharing and teamwork">
            Everything here lives in the top bar, next to your diagram&apos;s name.
          </PageHead>
          <ul className={styles.rows}>
            <Row icon={Share2} title="Share" pro {...rowProps}>
              A view-only link anyone can open, no account needed. They can save their own copy.
            </Row>
            <Row icon={UserPlus} title="Invite" pro {...rowProps}>
              Invite by email as an editor or a viewer. The diagram syncs to the cloud first.
            </Row>
            <Row icon={History} title="History" pro {...rowProps}>
              Save named versions and restore any of them. Restoring saves the current state first, so it can be
              undone.
            </Row>
            <Row icon={Cloud} title="Cloud sync" pro {...rowProps}>
              Save a diagram to the cloud from <b>My diagrams</b> to open it on any device. You can make it local-only
              again later.
            </Row>
            <Row icon={LayoutTemplate} title="My diagrams" {...rowProps}>
              Click the diagram&apos;s name in the top bar to switch, create, rename, duplicate or delete diagrams.
            </Row>
          </ul>
        </>
      );
      break;

    case "keys":
      page = (
        <>
          <PageHead title="Shortcuts">The mouse and keyboard controls for the canvas.</PageHead>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className={styles.group}>
              <span className={styles.label}>{group.title}</span>
              <div className={styles.keys}>
                {group.items.map((item) => (
                  <div key={item.label + item.keys.join()} className={styles.keyRow}>
                    <span>{item.label}</span>
                    <span className={styles.kbds}>
                      {item.keys.map((k, i) => (
                        <span key={k} className={styles.kbds}>
                          {i > 0 && "+"}
                          <span className={styles.kbd}>{k}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      );
      break;

    case "plan":
      page = (
        <>
          <PageHead title="Your plan">
            {isPro ? "You're on Pro. Everything in this guide is available to you." : "What Free includes, and what Pro adds."}
          </PageHead>
          <div className={styles.plans}>
            <div className={cn(styles.plan, !isPro && styles.planCurrent)}>
              {!isPro && <span className={styles.current}>Your plan</span>}
              <h4>Free</h4>
              <ul>
                <li>
                  <Check className="size-3.5" />
                  Write schemas in the Code tab
                </li>
                <li>
                  <Check className="size-3.5" />
                  View them on the canvas
                </li>
                <li>
                  <Check className="size-3.5" />
                  Up to {FREE_MAX_TABLES_PER_DIAGRAM} tables per diagram
                </li>
                <li>
                  <Check className="size-3.5" />
                  Up to {FREE_MAX_DIAGRAMS} diagrams, saved in this browser
                </li>
              </ul>
            </div>
            <div className={cn(styles.plan, isPro && styles.planCurrent)}>
              {isPro && <span className={styles.current}>Your plan</span>}
              <h4>Pro</h4>
              <ul>
                <li>
                  <Check className="size-3.5" />
                  The full visual editor and every side panel
                </li>
                <li>
                  <Check className="size-3.5" />
                  Unlimited tables and diagrams
                </li>
                <li>
                  <Check className="size-3.5" />
                  Cloud sync, sharing, invites and version history
                </li>
                <li>
                  <Check className="size-3.5" />
                  Import, export, DBML Docs and Luna AI
                </li>
              </ul>
            </div>
          </div>
        </>
      );
      break;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close();
          setSection("start");
        }
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader className={styles.header}>
          <span className={styles.badge}>
            <CircleHelp className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className={styles.title}>How dbluna works</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              A short guide to everything in the editor. Open it again any time from the ? button.
            </DialogDescription>
          </div>
          <span className={cn(styles.planTag, isPro && styles.planPro)}>{isPro ? "Pro" : "Free plan"}</span>
        </DialogHeader>

        <div className={styles.split}>
          <nav className={styles.nav} aria-label="Guide sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={styles.navItem}
                aria-current={section === id}
                onClick={() => setSection(id)}
              >
                <span className={styles.navIcon}>
                  <Icon className="size-3.5" />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.page} key={section}>
            {page}
          </div>
        </div>

        <div className={styles.foot}>
          <span className={styles.footInfo}>
            {SECTIONS.findIndex((s) => s.id === section) + 1} of {SECTIONS.length}
          </span>
          <span className={styles.spacer} />
          {!isPro && (
            <Link href="/pricing" onClick={close} className={styles.secondary}>
              <Sparkles className="size-4" />
              Upgrade to Pro
            </Link>
          )}
          {section !== "plan" ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setSection(SECTIONS[SECTIONS.findIndex((s) => s.id === section) + 1].id)}
            >
              Next
            </button>
          ) : null}
          <button type="button" className={styles.primary} onClick={close}>
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
