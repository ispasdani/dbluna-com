"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "convex/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  AlertCircle,
  ArrowUp,
  ArrowUpRight,
  Check,
  CircleSlash,
  Clock,
  Coins,
  Columns3,
  Link,
  Loader2,
  Lock,
  Pencil,
  ShoppingCart,
  Square,
  StickyNote,
  Table,
  Trash2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useAiChatStore } from "@/store/useAiChatStore";
import { applyToolCall } from "@/lib/ai/tool-executor";
import { useCloudAiChatSync } from "@/hooks/use-cloud-ai-chat-sync";
import { api } from "@/convex/_generated/api";
import styles from "./ai-chat.module.scss";

type MessagePart = UIMessage["parts"][number];

const isToolPart = (part: MessagePart) => part.type === "dynamic-tool" || part.type.startsWith("tool-");

// Icon and in-progress wording per tool. The finished line is the tool's own
// output string ("Added table "users" with 4 column(s).").
const TOOL_META: Record<string, { icon: LucideIcon; verb: string }> = {
  add_table: { icon: Table, verb: "Adding table" },
  update_table: { icon: Pencil, verb: "Updating table" },
  delete_table: { icon: Trash2, verb: "Deleting table" },
  add_column: { icon: Columns3, verb: "Adding a column to" },
  update_column: { icon: Pencil, verb: "Updating a column on" },
  delete_column: { icon: Trash2, verb: "Deleting a column from" },
  add_relationship: { icon: Link, verb: "Connecting" },
  add_note: { icon: StickyNote, verb: "Adding a note" },
  add_area: { icon: Square, verb: "Adding an area" },
};

/** One change Luna made (or is making) to the canvas. */
function ToolAction({ part }: { part: MessagePart }) {
  const toolName =
    part.type === "dynamic-tool" ? (part as { toolName: string }).toolName : part.type.replace(/^tool-/, "");
  const state = (part as { state?: string }).state;
  const errorText = (part as { errorText?: string }).errorText;
  const output = (part as { output?: unknown }).output;
  const input = (part as { input?: Record<string, unknown> }).input ?? {};

  const isRunning = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error" || !!errorText || (typeof output === "string" && output.startsWith("Error"));
  const meta = TOOL_META[toolName];
  const Icon = meta?.icon ?? WandSparkles;

  const subject = [input.name, input.tableName, input.sourceTable, input.title].find(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const text = isRunning
    ? `${meta?.verb ?? toolName}${subject ? ` ${subject}` : ""}…`
    : isError
      ? (errorText ?? String(output)).replace(/^Error:\s*/, "")
      : typeof output === "string"
        ? output
        : toolName;

  return (
    <div className={styles.action} data-state={isRunning ? "running" : isError ? "error" : "done"}>
      <span className={styles.actionIcon}>
        <Icon className="size-3" />
      </span>
      <span className={styles.actionText} title={text}>
        {text}
      </span>
      <span className={styles.actionState}>
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isError ? (
          <X className="size-2.5" strokeWidth={3} />
        ) : (
          <Check className="size-2.5" strokeWidth={3} />
        )}
      </span>
    </div>
  );
}

/** Luna's turn: text parts as markdown, runs of tool calls as one card. */
function AssistantParts({ parts }: { parts: MessagePart[] }) {
  const blocks: ({ kind: "text"; text: string } | { kind: "tools"; parts: MessagePart[] })[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      if (part.text.trim()) blocks.push({ kind: "text", text: part.text });
    } else if (isToolPart(part)) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "tools") last.parts.push(part);
      else blocks.push({ kind: "tools", parts: [part] });
    }
  }

  return (
    <>
      {blocks.map((block, i) =>
        block.kind === "text" ? (
          <div key={i} className={styles.prose}>
            <ReactMarkdown>{block.text}</ReactMarkdown>
          </div>
        ) : (
          <div key={i} className={styles.actions}>
            {block.parts.map((part, j) => (
              <ToolAction key={j} part={part} />
            ))}
          </div>
        )
      )}
    </>
  );
}

interface AiChatPanelProps {
  readOnly?: boolean;
  onClose?: () => void;
}

// Empty-state starters. Clicking one only fills the composer — sending spends
// a credit, so the user still confirms with Enter.
const SUGGESTIONS: { icon: LucideIcon; title: string; hint: string; prompt: string }[] = [
  {
    icon: Table,
    title: "Start with users",
    hint: "Email, password hash, profile fields",
    prompt: "Add a users table with id, email, password hash, name and timestamps",
  },
  {
    icon: ShoppingCart,
    title: "Sketch an orders flow",
    hint: "Customers, products, orders, line items",
    prompt: "Model an orders system with customers, products, orders and order items",
  },
  {
    icon: Link,
    title: "Find missing links",
    hint: "Spot foreign keys that should exist",
    prompt: "Look at my schema and suggest relationships that are missing",
  },
  {
    icon: Clock,
    title: "Track changes over time",
    hint: "created_at / updated_at on every table",
    prompt: "Add created_at and updated_at timestamps to every table",
  },
];

// Chat history is diagram-scoped and IndexedDB-persisted (useAiChatStore),
// local-only for v1. Gating the whole panel on hydration and keying the
// inner component by diagramId means useChat's `messages` init option always
// sees the right diagram's history on first render — no post-mount
// setMessages() call needed, which would otherwise race the persist effect
// below (both fire on mount; the persist effect would win and clobber the
// just-loaded history with the pre-load empty array).
export function AiChatPanel({ readOnly = false, onClose }: AiChatPanelProps) {
  const diagramId = useCanvasStore((s) => s.activeDiagramId) ?? "unsaved";
  const hasHydrated = useAiChatStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return <div className={styles.panel} />;
  }

  return (
    <AiChatPanelInner
      key={diagramId}
      diagramId={diagramId}
      readOnly={readOnly}
      onClose={onClose}
    />
  );
}

function AiChatPanelInner({
  diagramId,
  readOnly = false,
  onClose,
}: AiChatPanelProps & { diagramId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ai-chat-credits-and-sync-plan.md, Phase 1: live balance for the header
  // counter and the "out of credits" composer state. The route independently
  // re-checks and spends a credit server-side on every send — this query is
  // UX only, never the enforcement boundary.
  const plan = useQuery(api.users.getCurrentUserPlan);
  const outOfCredits = !readOnly && plan !== undefined && plan.isPro && plan.credits <= 0;

  const { messages, sendMessage, addToolOutput, setMessages, status, error } = useChat({
    id: diagramId,
    messages: useAiChatStore.getState().getMessages(diagramId),
    transport: new DefaultChatTransport({
      api: "/api/ai-chat",
      // Regenerated fresh per request straight from the live store, so the
      // model always sees the current schema rather than a stale snapshot.
      body: () => {
        const { tables, relationships, enums, tableGroups, project } =
          useCanvasStore.getState();
        return {
          dbml: generateDbmlFromCanvas(tables, relationships, {
            project,
            enums,
            tableGroups,
          }),
        };
      },
    }),
    // Client-side tool execution: the server only declares tools (no
    // `execute`), so calls stream here as events. Run them against the store
    // and report the result back so the model can confirm what happened.
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      const output = await applyToolCall(toolCall.toolName, toolCall.input);
      addToolOutput({ tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId, output });
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  // ai-chat-credits-and-sync-plan.md, Phase 2: no-op unless this diagram is
  // cloud-synced. Pull/merge happens inside the hook; push fires below once
  // a turn actually completes.
  const pushMessages = useCloudAiChatSync(diagramId, setMessages);
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip the first run after mount so opening the panel doesn't re-push
    // the whole seeded/cloud-merged history — same reasoning as
    // use-cloud-autosave.ts's own isInitialMount guard.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (status !== "ready") return;
    pushMessages(messages);
  }, [status, messages, pushMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    useAiChatStore.getState().setMessages(diagramId, messages);
  }, [diagramId, messages]);

  const handleSend = () => {
    if (readOnly) {
      useUpgradeToastStore.getState().trigger();
      return;
    }
    if (outOfCredits) return;
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  };

  const last = messages[messages.length - 1];
  const waiting = status === "submitted" && last?.role === "user";

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.mark}>
          <WandSparkles className="size-4" />
        </span>
        <span className={styles.headText}>
          <b>Luna AI</b>
          <small>Edits this diagram as you chat</small>
        </span>
        {plan?.isPro && (
          <span className={styles.credits} data-empty={outOfCredits} title="AI chat credits left this period">
            <Coins className="size-3.5" />
            {plan.credits}
          </span>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className={styles.iconBtn} title="Close" aria-label="Close Luna AI">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className={styles.scroll}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.intro}>
              <span className={`${styles.mark} ${styles.markLg}`}>
                <WandSparkles className="size-5" />
              </span>
              <h3>Describe it, Luna draws it.</h3>
              <p>
                Ask for new tables, changes to existing ones, or questions about how your schema fits together. Changes
                land straight on the canvas.
              </p>
            </div>

            <div>
              <span className={styles.label}>Try one of these</span>
              <div className={styles.starters}>
                {SUGGESTIONS.map(({ icon: Icon, title, hint, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => {
                      if (readOnly) {
                        useUpgradeToastStore.getState().trigger();
                        return;
                      }
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className={styles.starter}
                  >
                    <span className={styles.starterIcon}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className={styles.starterText}>
                      <b>{title}</b>
                      <small>{hint}</small>
                    </span>
                    <ArrowUpRight className={`size-3.5 ${styles.starterArrow}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className={styles.user}>
              {message.parts.map((part, i) => (part.type === "text" ? <Fragment key={i}>{part.text}</Fragment> : null))}
            </div>
          ) : (
            <div key={message.id} className={styles.assistant}>
              <span className={styles.mark}>
                <WandSparkles className="size-3" />
              </span>
              <div className={styles.assistantBody}>
                <AssistantParts parts={message.parts} />
              </div>
            </div>
          )
        )}

        {waiting && (
          <div className={styles.assistant}>
            <span className={styles.mark}>
              <WandSparkles className="size-3" />
            </span>
            <div className={styles.typing} aria-label="Luna is thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <AlertCircle className="size-3.5" />
            {error.message}
          </div>
        )}
      </div>

      <div className={styles.composerWrap}>
        {readOnly ? (
          <button type="button" onClick={() => useUpgradeToastStore.getState().trigger()} className={styles.notice}>
            <span className={styles.noticeIcon}>
              <Lock className="size-3.5" />
            </span>
            <span>
              Chat is on Pro
              <small>Upgrade to let Luna edit your diagrams.</small>
            </span>
            <span className={styles.noticeCta}>Upgrade</span>
          </button>
        ) : outOfCredits ? (
          <div className={styles.notice}>
            <span className={styles.noticeIcon}>
              <CircleSlash className="size-3.5" />
            </span>
            <span>
              Out of AI credits
              <small>Credits refill at the start of your next period.</small>
            </span>
          </div>
        ) : (
          <div className={styles.composer}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe a table, a change, or a question…"
              rows={1}
            />
            <div className={styles.composerFoot}>
              <span>
                <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
              </span>
              <button
                type="button"
                className={styles.send}
                onClick={handleSend}
                disabled={isBusy || !input.trim() || outOfCredits}
                title="Send"
                aria-label="Send"
              >
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
