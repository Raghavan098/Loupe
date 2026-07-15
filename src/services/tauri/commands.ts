import { open } from "@tauri-apps/plugin-dialog";
import { Channel, invoke } from "@tauri-apps/api/core";

export async function pickPdfPath(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  return typeof result === "string" ? result : null;
}

export type Provider = "anthropic" | "openai" | "google";

export async function saveApiKey(provider: Provider, apiKey: string): Promise<void> {
  await invoke("save_api_key", { provider, apiKey });
}

export async function deleteApiKey(provider: Provider): Promise<void> {
  await invoke("delete_api_key", { provider });
}

export async function hasApiKey(provider: Provider): Promise<boolean> {
  return invoke<boolean>("has_api_key", { provider });
}

export interface ChatImage {
  mimeType: string;
  /** Base64-encoded image bytes, without a `data:` URL prefix. */
  data: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: ChatImage;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function sendChatMessage(
  provider: Provider,
  model: string,
  messages: ChatMessage[],
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const channel = new Channel<ChatStreamEvent>();
  channel.onmessage = onEvent;
  await invoke("send_chat_message", { provider, model, messages, onEvent: channel });
}

export async function generateConversationTitle(
  provider: Provider,
  model: string,
  firstUserMessage: string,
  firstAssistantMessage: string,
): Promise<string> {
  return invoke("generate_conversation_title", {
    provider,
    model,
    firstUserMessage,
    firstAssistantMessage,
  });
}
