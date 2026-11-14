// A visitor's own API key (SPEC.md §7, mode 2). It lives in this browser's
// localStorage only and travels as request headers on that visitor's own
// questions; the server uses it in memory and never logs or stores it.

const STORAGE_KEY = "owid-explorer.llm";

export interface LlmConfig {
  provider: "anthropic" | "openai";
  key: string;
}

export function loadLlmConfig(): LlmConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed.provider === "anthropic" || parsed.provider === "openai") && parsed.key) {
      return parsed;
    }
  } catch {
    // corrupted entry: treat as absent
  }
  return null;
}

export function saveLlmConfig(config: LlmConfig | null): void {
  try {
    if (config) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): the key still works for this page view
  }
}
