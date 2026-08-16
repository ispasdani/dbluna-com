import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { api } from "@/convex/_generated/api";
import { aiTools } from "@/lib/ai/tools";

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

  // ai-chat-credits-and-sync-plan.md, Phase 1: spend one credit for this
  // turn before calling the model. Atomic (single Convex mutation), so two
  // concurrent requests from the same user can't both slip through on the
  // last credit. 402, not 403 — this is "you're allowed, but you're out",
  // distinct from the Pro gate above.
  try {
    await fetchMutation(api.users.consumeAiCredit, {}, { token });
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

  const result = streamText({
    model: google("gemini-flash-lite-latest"),
    system: SYSTEM_PROMPT(dbml ?? ""),
    messages: await convertToModelMessages(messages),
    tools: aiTools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
