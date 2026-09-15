"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "convex/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  WandSparkles,
  Send,
  Lock,
  Loader2,
  Check,
  X,
  Coins,
  CircleSlash,
  Table,
  ShoppingCart,
  Link,
  Clock,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useAiChatStore } from "@/store/useAiChatStore";
import { applyToolCall } from "@/lib/ai/tool-executor";
import { useCloudAiChatSync } from "@/hooks/use-cloud-ai-chat-sync";
import { api } from "@/convex/_generated/api";

type MessagePart = UIMessage["parts"][number];

function ToolCallPill({ part }: { part: MessagePart & { type: string } }) {
  const toolName =
    part.type === "dynamic-tool"
      ? (part as { toolName: string }).toolName
      : part.type.replace(/^tool-/, "");
  const state = (part as { state?: string }).state;
  const errorText = (part as { errorText?: string }).errorText;
  const output = (part as { output?: unknown }).output;

  const isRunning = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error" || !!errorText;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border",
        isError
          ? "border-destructive/40 text-destructive"
          : isRunning
          ? "border-border text-muted-foreground"
          : "border-primary/30 text-foreground"
      )}
    >
      {isRunning ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isError ? (
        <X className="w-3 h-3" />
      ) : (
        <Check className="w-3 h-3" />
      )}
      <span className="font-mono">{toolName}</span>
      {typeof output === "string" && !isError && (
        <span className="text-muted-foreground truncate">{output}</span>
      )}
      {isError && errorText && <span className="truncate">{errorText}</span>}
    </div>
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
    return <div className="h-full w-full bg-dock-bg" />;
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

  return (
    <div className="h-full w-full bg-dock-bg text-foreground flex flex-col">
      {/* Header */}
      <div className="flex-none h-10 px-3 flex items-center gap-2 border-b border-border bg-dock-header select-none">
        <WandSparkles className="w-4 h-4 text-[#f0543c]" />
        <span className="text-xs font-medium text-foreground">Luna AI</span>
        {plan?.isPro && (
          <span
            className={cn(
              "ml-auto flex items-center gap-1 text-xs",
              outOfCredits ? "text-destructive" : "text-muted-foreground"
            )}
            title="AI chat credits remaining this period"
          >
            <Coins className="w-3 h-3" />
            {plan.credits}
          </span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "h-7 w-7 -mr-1 flex items-center justify-center rounded-md cursor-pointer",
              "text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              !plan?.isPro && "ml-auto"
            )}
            title="Close"
            aria-label="Close Luna AI"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col justify-center gap-5 px-1">
            <div className="flex flex-col gap-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#ff8a5c] to-[#e5392a] shadow-md shadow-[#e5392a]/20">
                <WandSparkles className="w-4.5 h-4.5" />
              </div>
              <p className="text-base font-semibold text-foreground leading-snug">
                Describe it, Luna draws it.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask for new tables, changes to existing ones, or questions about
                how your schema fits together.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Try one of these
              </span>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
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
                    className="group flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    <span className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center bg-[#ff6347]/10 text-[#e5392a]">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground">{title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{hint}</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-md px-3 py-2 text-sm max-w-[90%] break-words",
              message.role === "user"
                ? "bg-primary/10 ml-auto"
                : "bg-muted mr-auto"
            )}
          >
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{part.text}</ReactMarkdown>
                  </div>
                );
              }
              if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
                return <ToolCallPill key={i} part={part} />;
              }
              return null;
            })}
          </div>
        ))}
        {error && (
          <div className="text-xs text-destructive px-1">{error.message}</div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-none border-t border-border p-2">
        {readOnly ? (
          <button
            type="button"
            onClick={() => useUpgradeToastStore.getState().trigger()}
            className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <Lock className="w-3 h-3" />
            Upgrade to chat with AI
          </button>
        ) : outOfCredits ? (
          <div className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-2">
            <CircleSlash className="w-3 h-3" />
            Out of AI credits for this period
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
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
              className="min-h-9 max-h-32 resize-none text-sm"
              rows={1}
            />
            <Button
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={handleSend}
              disabled={isBusy || !input.trim() || outOfCredits}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
