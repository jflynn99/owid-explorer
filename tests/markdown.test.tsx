import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import Markdown from "../components/agent/Markdown";

// Renders the real component to a static string (no DOM needed) so we assert the
// actual sanitised output the chats will show.
const render = (md: string) => renderToStaticMarkup(createElement(Markdown, { children: md }));

describe("Markdown renderer", () => {
  it("renders a markdown link as a safe external anchor", () => {
    const html = render("See [Life expectancy](https://ourworldindata.org/life-expectancy).");
    expect(html).toContain('href="https://ourworldindata.org/life-expectancy"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    // The raw markdown syntax must not survive.
    expect(html).not.toContain("](https://");
  });

  it("renders emphasis and lists", () => {
    const html = render("**bold** and *italic*\n\n- one\n- two");
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
    expect(html).toContain("<li");
  });

  it("never emits a script element from model output", () => {
    // react-markdown doesn't enable rehype-raw, so raw HTML is inert text, and
    // rehype-sanitize is the backstop. Either way, no executable <script> survives.
    const html = render("Hello <script>alert(1)</script> world");
    expect(html).not.toContain("<script");
  });

  it("drops a javascript: link protocol", () => {
    const html = render("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });
});
