import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ChatTranscript from "../components/chat/ChatTranscript";
import type { ExplorerChat } from "../components/chat/useExplorerChat";

// Only the fields ChatTranscript reads.
function chatWith(assistantParts: object[]): ExplorerChat {
  return {
    messages: [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Write me a poem" }] },
      { id: "a1", role: "assistant", parts: assistantParts },
    ],
    busy: false,
    errorText: null,
    retry: () => {},
  } as unknown as ExplorerChat;
}

const render = (chat: ExplorerChat) => renderToStaticMarkup(createElement(ChatTranscript, { chat }));

describe("ChatTranscript empty replies", () => {
  it("explains a reply with no text and offers a retry", () => {
    const html = render(chatWith([{ type: "step-start" }, { type: "text", text: "  " }]));
    expect(html).toContain("No answer came back");
    expect(html).toContain("try again");
  });

  it("says nothing extra when the reply has text", () => {
    const html = render(chatWith([{ type: "text", text: "Here is the chart." }]));
    expect(html).not.toContain("No answer came back");
  });
});
