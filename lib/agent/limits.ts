// Per-request cost limits for the chat route.
//
// The prompt asks the model to be brief, but a prompt is a request, not a
// limit. These are the hard ceilings: how much a caller may send, how many
// tool rounds a question may take, and how much the model may write back.

// Output cap, per model call. Current Claude models think before answering
// and that thinking counts toward the cap, so this leaves room for thinking
// plus either a short answer (~200 tokens) or a chart spec (~400 tokens).
export const CHAT_MAX_OUTPUT_TOKENS = 2500;

// Tool rounds per question: search, check the data, draw, explain, with a
// little slack for one retry.
export const CHAT_MAX_STEPS = 6;

// Only the most recent messages are sent to the model.
export const CHAT_HISTORY_MESSAGES = 12;

// Input cap, measured as characters of the JSON-encoded message history
// (roughly 3-4 characters per token). History carries tool results (search
// hits, data previews, article excerpts), so this is sized for a dozen turns
// of those and no more.
export const CHAT_MAX_INPUT_CHARS = 100_000;

export type PreparedMessages =
  | { ok: true; messages: unknown[] }
  | { ok: false; reason: "too_large" };

// Checks the history against a size cap and removes the model's reasoning
// from earlier turns.
//
// Why strip reasoning: current Claude models sign their thinking against
// everything that came before it. This route trims old turns and rebuilds its
// system prompt from whichever chart is on screen, either of which makes a
// replayed thinking block invalid and fails the request. The reasoning text
// is never shown here anyway, so dropping it from history costs nothing.
// (Within a single tool-calling run the AI SDK keeps thinking intact itself.)
export function prepareMessages(messages: unknown[], maxChars: number): PreparedMessages {
  const cleaned = messages.map((message) => {
    if (typeof message !== "object" || message === null) return message;
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return message;
    return {
      ...message,
      parts: parts.filter(
        (part) =>
          typeof part !== "object" || part === null || (part as { type?: unknown }).type !== "reasoning"
      ),
    };
  });
  if (JSON.stringify(cleaned).length > maxChars) return { ok: false, reason: "too_large" };
  return { ok: true, messages: cleaned };
}
