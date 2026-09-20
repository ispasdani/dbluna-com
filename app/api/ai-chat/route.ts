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
import type { Id } from "@/convex/_generated/dataModel";
import { aiTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { ConvexError } from "convex/values";
import {
  AI_CHAT_MODEL_ID,
  MAX_CREDITS_PER_TURN,
  MAX_INPUT_TOKENS_PER_REQUEST,
  MAX_OUTPUT_TOKENS_PER_STEP,
  MAX_REQUEST_BODY_BYTES,
  MAX_STEPS_PER_TURN,
  creditsForUsage,
  creditsRemainingPercent,
  estimateTokens,
  minimumCreditsForRequest,
  type AiChatStreamMetadata,
  type AiChatUsage,
} from "@/lib/ai-credits";

/**
 * Fixed cost of the 9 tool schemas plus the instruction block, resent on every
 * step. Counted into the size guard because on a small diagram it's the
 * largest single part of the prompt.
 */
const TOOL_SCHEMA_TOKEN_OVERHEAD = 2_500;

/**
 * `reserveAiCredit` rejects for three different reasons and the client needs
 * to tell them apart: out of credits is the user's problem and offers a
 * top-up, rate limited resolves itself in a minute, capacity reached is ours
 * and nothing the user did.
 */
function reserveErrorResponse(err: unknown): NextResponse {
  const code =
    err instanceof ConvexError &&
    typeof err.data === "object" &&
    err.data !== null &&
    "code" in err.data
      ? String((err.data as { code: unknown }).code)
      : undefined;

  switch (code) {
    case "REQUEST_TOO_LARGE_FOR_BALANCE":
      return NextResponse.json(
        {
          success: false,
          error:
            "There isn't enough of this month's AI allowance left for a request " +
            "this size. Try a smaller question, or wait for it to reset.",
        },
        { status: 402 }
      );
    case "RATE_LIMITED":
      return NextResponse.json(
        { success: false, error: "Slow down a moment — too many AI requests." },
        { status: 429 }
      );
    case "CAPACITY_REACHED":
      console.error("[ai-chat] refused: global monthly credit ceiling reached");
      return NextResponse.json(
        {
          success: false,
          error: "AI chat is temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    case "OUT_OF_CREDITS":
      return NextResponse.json(
        { success: false, error: "Out of AI credits." },
        { status: 402 }
      );
    default:
      // An unrecognised failure (auth, plan lapsed mid-request, Convex down).
      // 402 keeps the previous behaviour for the client, but it's logged
      // because it isn't actually a credits problem.
      console.error("[ai-chat] credit reservation failed", err);
      return NextResponse.json(
        { success: false, error: "Could not start the AI request." },
        { status: 402 }
      );
  }
}

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

const EMPTY_USAGE: AiChatUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
};

function addUsage(a: AiChatUsage, b: AiChatUsage): AiChatUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/** Total usage across the steps completed so far. */
function sumStepUsage(steps: readonly { usage: LanguageModelUsage }[]): AiChatUsage {
  return steps.reduce(
    (sum, step) => addUsage(sum, toAiChatUsage(step.usage)),
    EMPTY_USAGE
  );
}

export const maxDuration = 30;

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

  // Two size checks, because either one alone is insufficient. The header is
  // free but a client controls it, so it catches honest oversize requests
  // early without buffering; the length check after reading catches a body
  // that lied about (or omitted) its length, before it becomes an object
  // graph. The token ceiling further down can only run once parsed.
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request too large." },
      { status: 413 }
    );
  }

  let body: { messages: UIMessage[]; dbml?: string };
  try {
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Request too large." },
        { status: 413 }
      );
    }
    body = JSON.parse(raw);
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

  // Size guard before anything is charged. Refusing beats truncating: dropping
  // tables to fit would have the model answer confidently about a schema the
  // user isn't looking at. This is also what bounds MAX_CREDITS_PER_TURN.
  const estimatedInputTokens =
    estimateTokens(dbml ?? "") +
    estimateTokens(JSON.stringify(messages)) +
    TOOL_SCHEMA_TOKEN_OVERHEAD;

  if (estimatedInputTokens > MAX_INPUT_TOKENS_PER_REQUEST) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This diagram and conversation are too large for one AI request. " +
          "Start a new chat, or split the diagram across schemas.",
      },
      { status: 413 }
    );
  }

  // Reserve one credit; the rest is settled against real token usage once the
  // turn ends (see `settle` below). Atomic (single Convex mutation), so the
  // balance check, the per-user rate limit and the org-wide breaker all happen
  // in one transaction — two tabs can't both slip through on the last credit.
  // Deliberately after body validation: a malformed request must not cost a
  // credit.
  let budget: number;
  let reservationId: Id<"aiChatReservations">;
  try {
    const reservation = await fetchMutation(
      api.users.reserveAiCredit,
      { minimumCredits: minimumCreditsForRequest(estimatedInputTokens) },
      { token }
    );
    reservationId = reservation.reservationId;
    // Everything the user had when the turn began — what it's allowed to
    // spend before the budget stop condition halts it.
    budget = reservation.remaining + reservation.reserved;
  } catch (err) {
    return reserveErrorResponse(err);
  }

  // Running cost, updated after every step. Drives the live gauge.
  let runningUsage: AiChatUsage = EMPTY_USAGE;
  let spentCredits = 0;
  let stoppedForBudget = false;

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

    // Hands over the turn's total plus the reservation, and lets the mutation
    // subtract what it already took. Sending a pre-computed difference would
    // put the arithmetic on the untrusted side of the boundary — and this
    // mutation is public, so that side is reachable from a browser console.
    // Always called, even when nothing further is owed, so the reservation is
    // consumed rather than left dangling.
    try {
      await fetchMutation(
        api.users.settleAiCredits,
        { reservationId, totalCredits: credits },
        { token }
      );
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
    system: buildSystemPrompt(dbml ?? ""),
    messages: await convertToModelMessages(messages),
    tools: aiTools,
    // Enforced, not assumed: MAX_OVERDRAFT_CREDITS is only provable if a
    // single step's output is bounded.
    maxOutputTokens: MAX_OUTPUT_TOKENS_PER_STEP,
    stopWhen: [
      stepCountIs(MAX_STEPS_PER_TURN),
      // Stop as soon as the turn has spent everything the user had. Evaluated
      // *between* steps, so the current tool call always completes — the model
      // is never cut off mid-call, and each applied edit stays atomic.
      //
      // Computed from `steps` rather than the running total below, because
      // this is the authoritative figure and must not depend on callback
      // ordering.
      ({ steps }) => {
        if (creditsForUsage(sumStepUsage(steps)) < budget) return false;
        stoppedForBudget = true;
        return true;
      },
    ],
    // Keeps the live gauge moving during generation.
    onStepEnd: (step) => {
      runningUsage = addUsage(runningUsage, toAiChatUsage(step.usage));
      spentCredits = creditsForUsage(runningUsage);
    },
    // `onEnd`, not the deprecated `onFinish`. Usage here is combined across
    // every step of the turn, which is what we want to bill on.
    onEnd: ({ totalUsage }) => settle(toAiChatUsage(totalUsage)),
    // A user who closes the tab mid-turn still cost us the steps that ran.
    onAbort: ({ steps }) => settle(sumStepUsage(steps)),
  });

  // Keep generating (and therefore keep metering) even if the client
  // disconnects — without this, a closed tab can leave the turn unbilled.
  void result.consumeStream();

  return result.toUIMessageStreamResponse({
    // Pushes the balance to the client as the turn runs, so a large refactor
    // visibly draws the gauge down instead of jumping at the end. Emitted on
    // every step boundary and once more at the finish, where
    // `stoppedForBudget` is finally known.
    messageMetadata: ({ part }): AiChatStreamMetadata | undefined => {
      if (part.type !== "finish-step" && part.type !== "finish") return undefined;

      return {
        creditsPercent: creditsRemainingPercent(Math.max(budget - spentCredits, 0)),
        stoppedForBudget,
      };
    },
  });
}
