import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Readable } from "node:stream";
import { parseBacpacModel } from "@/lib/parser/bacpac-model";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Sign in to import a schema." },
      { status: 401 },
    );
  }

  if (!req.body) {
    return NextResponse.json(
      { success: false, error: "No XML body provided" },
      { status: 400 },
    );
  }

  try {
    const input = Readable.fromWeb(req.body as import("node:stream/web").ReadableStream);
    return NextResponse.json({ success: true, ...await parseBacpacModel(input) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
