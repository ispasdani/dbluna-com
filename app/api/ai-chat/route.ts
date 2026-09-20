import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { api } from "@/convex/_generated/api";
import { aiTools } from "@/lib/ai/tools";
import {
  AI_CHAT_MODEL_ID,
  MAX_CREDITS_PER_TURN,
  creditsForUsage,
  type AiChatUsage,
} from "@/lib/ai-credits";

/**
 * The SDK reports every usage field as `number | undefined`, and reads cached
 * tokens out of a nested detail object. Normalising once here keeps the
 * billing maths in lib/ai-credits.ts free of that shape.
 */
function toAiChatUsage(usage: LanguageModelUsage): AiChatUsage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  };
}

export const maxDuration = 30;

const SYSTEM_PROMPT = (dbml: string) => `You are the AI assistant inside DBLuna, a database diagram editor. \
You help the user understand the schema they're currently editing, and you can edit it for them using the \
provided tools (add/update/delete tables, columns, and relationships; add notes and areas).

Rules:
- Refer to tables and columns by name, never by id — you don't have ids.
- Before adding a relationship or column, make sure the table/column names you're using actually exist in \
the current schema below. If something doesn't exist, say so instead of guessing.
- When the user asks for a schema change and your plan is reasonably clear, just call the tools and make \
it — don't describe the plan and ask "should I go ahead?" first. Only ask before acting when the request \
is genuinely ambiguous (e.g. naming/structure could reasonably go multiple ways) or destructive (deleting \
tables/columns the user didn't explicitly name).
- After a tool call finishes, briefly confirm what changed using the tool's result. If a tool call returns \
an error, relay it plainly and suggest a fix — don't retry blindly.
- For pure questions, answer directly from the schema below without calling any tool.

Current diagram schema (DBML):
\`\`\`dbml
${dbml || "-- empty diagram, no tables yet --"}
\`\`\`

Be concise.`;

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to use AI chat." },
      { status: 401 }
    );
  }

  const token = (await getToken({ template: "convex" })) ?? undefined;
  const { isPro } = await fetchQuery(api.users.getCurrentUserPlan, {}, { token });
  if (!isPro) {
    return NextResponse.json(
      { success: false, error: "Upgrade to Pro to use AI chat." },
      { status: 403 }
    );
  }

  // Reserve one credit before calling the model; the rest is settled against
  // real token usage once the turn ends (see `settle` below). Atomic (single
  // Convex mutation), so two concurrent requests from the same user can't both
  // slip through on the last credit. 402, not 403 — this is "you're allowed,
  // but you're out", distinct from the Pro gate above.
  try {
    await fetchMutation(api.users.reserveAiCredit, {}, { token });
  } catch {
    return NextResponse.json(
      { success: false, error: "Out of AI credits." },
      { status: 402 }
    );
  }

  let body: { messages: UIMessage[]; dbml?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { messages, dbml } = body;
  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { success: false, error: "messages is required." },
      { status: 400 }
    );
  }

  // Charge what the turn actually cost, beyond the one credit already
  // reserved. Idempotent by construction: each of onEnd/onAbort fires at most
  // once per turn and they're mutually exclusive.
  //
  // Uses the token minted at the top of this request. Clerk JWT template
  // tokens are short-lived, so this only stays valid because `maxDuration` is
  // well inside that lifetime — raising maxDuration above it would make
  // settlement start failing silently, and we'd under-bill every long turn.
  const settle = async ({ inputTokens, cachedInputTokens, outputTokens }: AiChatUsage) => {
    const credits = creditsForUsage({ inputTokens, cachedInputTokens, outputTokens });

    if (credits > MAX_CREDITS_PER_TURN) {
      // Above any legitimate turn — log loudly rather than quietly draining a
      // balance, then charge the cap.
      console.error(
        `[ai-chat] turn exceeded MAX_CREDITS_PER_TURN: ${credits} credits ` +
          `(in ${inputTokens}, cached ${cachedInputTokens ?? 0}, out ${outputTokens})`
      );
    }

    // -1 for the credit already reserved before the turn started.
    const additionalCredits = Math.min(credits, MAX_CREDITS_PER_TURN) - 1;
    if (additionalCredits <= 0) return;

    try {
      await fetchMutation(api.users.settleAiCredits, { additionalCredits }, { token });
    } catch (err) {
      // Never surface this to the user — the turn already succeeded. But it
      // means we ate the cost, so it has to be visible in logs.
      console.error("[ai-chat] failed to settle credits", err);
    }
  };

  const result = streamText({
    // Pinned deliberately — `gemini-flash-lite-latest` is a floating alias that
    // Google hot-swaps (2 weeks' notice), which silently re-prices our COGS and
    // the credit maths in ai-chat-credits-and-sync-plan.md along with it. It had
    // already drifted off the 2.5 Flash-Lite pricing that plan was costed
    // against. 3.1 Flash-Lite is $0.25/$1.50 per 1M in/out and is the tier
    // Google markets for high-volume agentic (tool-calling) work, which is
    // exactly this route. Changing this model means re-deriving the credit unit.
    model: google(AI_CHAT_MODEL_ID),
    system: SYSTEM_PROMPT(dbml ?? ""),
    messages: await convertToModelMessages(messages),
    tools: aiTools,
    stopWhen: stepCountIs(8),
    // `onEnd`, not the deprecated `onFinish`. Usage here is combined across
    // every step of the turn, which is what we want to bill on.
    onEnd: ({ totalUsage }) => settle(toAiChatUsage(totalUsage)),
    // A user who closes the tab mid-turn still cost us the steps that ran.
    onAbort: ({ steps }) =>
      settle(
        steps
          .map((step) => toAiChatUsage(step.usage))
          .reduce(
            (sum, usage) => ({
              inputTokens: sum.inputTokens + usage.inputTokens,
              cachedInputTokens:
                (sum.cachedInputTokens ?? 0) + (usage.cachedInputTokens ?? 0),
              outputTokens: sum.outputTokens + usage.outputTokens,
            }),
            { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }
          )
      ),
  });

  // Keep generating (and therefore keep metering) even if the client
  // disconnects — without this, a closed tab can leave the turn unbilled.
  void result.consumeStream();

  return result.toUIMessageStreamResponse();
}
