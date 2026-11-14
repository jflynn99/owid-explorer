// Per-request cost limits for the two chat routes.
//
// The prompts ask the model to be brief, but a prompt is a request, not a
// limit. These are the hard ceilings: how much a caller may send, and how much
// the model may write back.

// Output caps. Newer Claude models think before answering and that thinking
// counts toward the cap, so these leave room for it on top of the visible
// answer (chart chat answers are ~180 words, roughly 300 tokens).
export const CHART_CHAT_MAX_OUTPUT_TOKENS = 1500;
export const AGENT_MAX_OUTPUT_TOKENS = 4000;

// Input caps, measured as characters of the JSON-encoded message history
// (roughly 3-4 characters per token). Chart chat runs on the site's key, so
// it is tight: enough for a dozen short turns plus the article excerpts the
// model pulled in. The agent runs on the visitor's own key and carries chart
// specs and tool results, so it is looser — the cap there only stops a
// runaway payload.
export const CHART_CHAT_MAX_INPUT_CHARS = 60_000;
export const AGENT_MAX_INPUT_CHARS = 600_000;

export type PreparedMessages =
  | { ok: true; messages: unknown[] }
  | { ok: false; reason: "too_large" };

// Checks the history against a size cap and removes the model's reasoning
// from earlier turns.
//
// Why strip reasoning: current Claude models sign their thinking against
// everything that came before it. Chart chat trims old turns and rebuilds its
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
