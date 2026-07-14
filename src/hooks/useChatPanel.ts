import { useCallback, useRef, useState } from "react";
import {
  sendChatMessage,
  type ChatMessage,
  type Provider,
} from "../services/tauri/commands";

const EXPLAIN_PROMPT_TEMPLATE = (selectedText: string) =>
  `Explain the following passage from the document in plain, accessible language. ` +
  `Keep the explanation concise unless the passage requires more detail to make sense.\n\n"""\n${selectedText}\n"""`;

export function useChatPanel(provider: Provider, model: string) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Mirrors `messages` so `send` can read the latest history synchronously
  // (before its own optimistic append lands) without a stale closure.
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const historyToSend = [...messagesRef.current, userMessage];

      setMessages((m) => [...m, userMessage, { role: "assistant", content: "" }]);
      setStreaming(true);

      const setAssistantContent = (content: string) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content };
          return copy;
        });
      };

      try {
        await sendChatMessage(provider, model, historyToSend, (event) => {
          if (event.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + event.text };
              return copy;
            });
          } else if (event.type === "error") {
            setAssistantContent(`⚠ ${event.message}`);
          }
        });
      } catch (err) {
        // Fallback for a rejected invoke() promise that never emitted an
        // "error" event on the channel (e.g. it failed before Rust ran).
        setAssistantContent(`⚠ ${String(err)}`);
      } finally {
        setStreaming(false);
      }
    },
    [provider, model, streaming],
  );

  const insertText = useCallback((text: string) => {
    setDraft((d) => (d ? `${d}\n\n${text}` : text));
    setOpen(true);
  }, []);

  const explain = useCallback(
    (selectedText: string) => {
      setOpen(true);
      void send(EXPLAIN_PROMPT_TEMPLATE(selectedText));
    },
    [send],
  );

  const sendDraft = useCallback(() => {
    const text = draft;
    setDraft("");
    void send(text);
  }, [draft, send]);

  return {
    open,
    setOpen,
    messages,
    draft,
    setDraft,
    streaming,
    insertText,
    explain,
    sendDraft,
  };
}
