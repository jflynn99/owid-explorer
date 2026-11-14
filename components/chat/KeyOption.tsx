"use client";

// The "use your own key" option: one quiet link that opens a small form in
// place. Most visitors never need it; it is there for anyone who wants to
// keep going past the free daily questions.

import { useState } from "react";
import type { LlmConfig } from "./llmConfig";

const field =
  "rounded-sm border border-gray-400 bg-transparent px-2 py-1.5 text-sm focus:border-blue-600 focus:outline-none dark:border-slate-600 dark:focus:border-blue-400";

export default function KeyOption({
  config,
  onChange,
}: {
  config: LlmConfig | null;
  onChange: (config: LlmConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<LlmConfig["provider"]>("anthropic");
  const [key, setKey] = useState("");

  if (config) {
    return (
      <span>
        Using your {config.provider} key, no daily limit.{" "}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="underline underline-offset-2 hover:text-red-700 dark:hover:text-red-300"
        >
          Remove it
        </button>
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-slate-100"
      >
        Use your own key
      </button>
    );
  }

  function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    onChange({ provider, key: trimmed });
    setKey("");
    setOpen(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mt-2 w-full border-t border-gray-200 pt-3 dark:border-slate-800"
    >
      <p className="text-xs text-gray-600 dark:text-slate-400">
        With your own Anthropic or OpenAI key there is no daily limit. The key is kept in this
        browser only and sent with your questions; the server never stores it.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as LlmConfig["provider"])}
          className={field}
          aria-label="Provider"
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
          aria-label="API key"
          autoComplete="off"
          className={`min-w-48 flex-1 ${field}`}
        />
        <button
          type="submit"
          disabled={!key.trim()}
          className="rounded-sm bg-gray-900 px-3 py-1.5 text-sm text-gray-50 hover:bg-gray-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-300"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
