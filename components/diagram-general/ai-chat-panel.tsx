"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Sparkles, Send, Lock, Loader2, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import { generateDbmlFromCanvas } from "@/lib/generator/dbml-generator";
import { useUpgradeToastStore } from "@/store/useUpgradeToastStore";
import { useAiChatStore } from "@/store/useAiChatStore";
import { applyToolCall } from "@/lib/ai/tool-executor";

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
}

// Chat history is diagram-scoped and IndexedDB-persisted (useAiChatStore),
// local-only for v1. Gating the whole panel on hydration and keying the
// inner component by diagramId means useChat's `messages` init option always
// sees the right diagram's history on first render — no post-mount
// setMessages() call needed, which would otherwise race the persist effect
// below (both fire on mount; the persist effect would win and clobber the
// just-loaded history with the pre-load empty array).
export function AiChatPanel({ readOnly = false }: AiChatPanelProps) {
  const diagramId = useCanvasStore((s) => s.activeDiagramId) ?? "unsaved";
  const hasHydrated = useAiChatStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return <div className="h-full w-full bg-dock-bg" />;
  }

  return <AiChatPanelInner key={diagramId} diagramId={diagramId} readOnly={readOnly} />;
}

function AiChatPanelInner({
  diagramId,
  readOnly = false,
}: AiChatPanelProps & { diagramId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, addToolOutput, status, error } = useChat({
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
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="h-full w-full bg-dock-bg text-foreground flex flex-col">
      {/* Header */}
      <div className="flex-none h-10 px-3 flex items-center gap-2 border-b border-border bg-dock-header select-none">
        <Sparkles className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">AI Chat</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center mt-8">
            Ask about your schema — e.g. &ldquo;what tables reference
            users?&rdquo;
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
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your schema..."
              className="min-h-9 max-h-32 resize-none text-sm"
              rows={1}
            />
            <Button
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={handleSend}
              disabled={isBusy || !input.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
