import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { api } from "@/convex/_generated/api";

export const maxDuration = 30;

const SYSTEM_PROMPT = (dbml: string) => `You are the AI assistant inside DBLuna, a database diagram editor. \
You help the user understand the schema they're currently editing by answering questions about it.

You cannot edit the diagram yet — if the user asks you to add, remove, or change tables, columns, or \
relationships, explain that diagram editing from chat is coming soon, and instead describe what they'd \
need to change.

Current diagram schema (DBML):
\`\`\`dbml
${dbml || "-- empty diagram, no tables yet --"}
\`\`\`

Answer questions using only this schema. Be concise.`;

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
    model: google("gemini-2.5-flash-lite"),
    system: SYSTEM_PROMPT(dbml ?? ""),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
