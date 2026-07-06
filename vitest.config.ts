import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Match Next's automatic JSX runtime so component tests (e.g. the Markdown
// renderer) don't need a React global, and mirror tsconfig's "@/*" alias so
// route handlers (which import via "@/lib/...") can be tested directly.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": root } },
});
