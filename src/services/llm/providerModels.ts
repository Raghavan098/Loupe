import type { Provider } from "../tauri/commands";

export const PROVIDERS: Provider[] = ["anthropic", "openai", "google"];

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google (Gemini)",
};

// Starting suggestions only — model catalogs change frequently across all
// three providers, so the Settings model field is an editable combo box
// (dropdown + free text), not a locked-down enum. Update these as needed
// without touching the Rust backend, which just forwards whatever string
// is selected.
export const SUGGESTED_MODELS: Record<Provider, string[]> = {
  anthropic: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
  openai: ["gpt-5.1", "gpt-5.1-mini", "gpt-4.1"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-opus-4-8",
  openai: "gpt-5.1",
  google: "gemini-2.5-pro",
};
