import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vite 8 transforms with oxc, whose default is the automatic JSX runtime, so
// component tests (e.g. the Markdown renderer) need no React global. The alias
// mirrors tsconfig's "@/*" so route handlers (which import via "@/lib/...")
// can be tested directly.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
});
