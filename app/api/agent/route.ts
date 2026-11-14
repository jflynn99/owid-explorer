import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { getModel, resolveProvider } from "@/lib/agent/providers";
import { agentTools } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompts";
import { AGENT_MAX_INPUT_CHARS, AGENT_MAX_OUTPUT_TOKENS, prepareMessages } from "@/lib/agent/limits";

const bodySchema = z.object({ messages: z.array(z.unknown()).min(1).max(200) });

export const maxDuration = 60;

// GET reports whether the server has an LLM configured, so the UI can decide
// whether to show the key manager gate. Never returns key material.
export async function GET() {
  const server = resolveProvider({});
  return NextResponse.json({
    configured: server !== null,
    provider: server?.provider ?? null,
  });
}

export async function POST(req: NextRequest) {
  // Client keys are used in-memory for this request only — never logged,
  // never persisted (SPEC.md §7).
  const selection = resolveProvider({
    provider: req.headers.get("x-llm-provider"),
    key: req.headers.get("x-llm-key"),
  });
  if (!selection) {
    return NextResponse.json(
      { error: "no_provider", message: "Add an API key to enable the agent." },
      { status: 401 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const prepared = prepareMessages(parsed.data.messages, AGENT_MAX_INPUT_CHARS);
  if (!prepared.ok) {
    return NextResponse.json(
      { error: "too_large", message: "This conversation is too long. Start a new one." },
      { status: 413 }
    );
  }

  const result = streamText({
    model: getModel(selection),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(
      prepared.messages as Parameters<typeof convertToModelMessages>[0]
    ),
    tools: agentTools,
    stopWhen: stepCountIs(10),
    maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse();
}
