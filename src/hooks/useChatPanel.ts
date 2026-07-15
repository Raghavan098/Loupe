import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendChatMessage,
  generateConversationTitle,
  type ChatMessage,
  type Provider,
} from "../services/tauri/commands";
import type { Conversation } from "../types/conversation";

const EXPLAIN_PROMPT_TEMPLATE = (selectedText: string) =>
  `Explain the following passage from the document in plain, accessible language. ` +
  `Keep the explanation concise unless the passage requires more detail to make sense.\n\n"""\n${selectedText}\n"""`;

const NEW_CONVERSATION_TITLE = "New conversation";
const FALLBACK_TITLE_LENGTH = 50;

interface PendingImage {
  dataUrl: string;
  mimeType: string;
}

export function useChatPanel(pdfPath: string | null, provider: Provider, model: string) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [streaming, setStreaming] = useState(false);

  // Opening a different PDF always starts a fresh conversation; past ones for
  // that PDF (or any other) remain in `conversations` and stay reachable via
  // the history popover.
  useEffect(() => {
    setActiveId(null);
  }, [pdfPath]);

  // Mirror `conversations`/`activeId` so `send` can read the latest state
  // synchronously (before its own optimistic updates land) without a stale
  // closure, the same pattern the previous single-conversation version of
  // this hook used for `messages`.
  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];
  const activeTitle = activeConversation?.title ?? NEW_CONVERSATION_TITLE;
  const conversationsForPdf = conversations
    .filter((c) => c.pdfPath === pdfPath)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const send = useCallback(
    async (text: string, image?: PendingImage | null) => {
      const trimmed = text.trim();
      if ((!trimmed && !image) || streaming || !pdfPath) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: trimmed,
        // The staged image is a full data: URL (what <img src> needs); the
        // wire format is bare base64, so strip the prefix only here.
        ...(image ? { image: { mimeType: image.mimeType, data: image.dataUrl.split(",")[1] } } : {}),
      };

      const existing = conversationsRef.current.find((c) => c.id === activeIdRef.current) ?? null;
      const isFirstExchange = !existing || existing.messages.length === 0;

      let conv: Conversation;
      if (existing) {
        conv = existing;
      } else {
        conv = {
          id: crypto.randomUUID(),
          pdfPath,
          title: NEW_CONVERSATION_TITLE,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setConversations((cs) => [...cs, conv]);
        setActiveId(conv.id);
      }

      const historyToSend = [...conv.messages, userMessage];

      const patchMessages = (updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
        setConversations((cs) =>
          cs.map((c) => (c.id === conv.id ? { ...c, messages: updater(c.messages), updatedAt: Date.now() } : c)),
        );
      };

      patchMessages((m) => [...m, userMessage, { role: "assistant", content: "" }]);
      setStreaming(true);

      let assistantText = "";
      const setAssistantContent = (content: string) => {
        assistantText = content;
        patchMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content };
          return copy;
        });
      };

      try {
        await sendChatMessage(provider, model, historyToSend, (event) => {
          if (event.type === "delta") {
            assistantText += event.text;
            patchMessages((m) => {
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

      if (isFirstExchange) {
        const conversationId = conv.id;
        try {
          const title = await generateConversationTitle(provider, model, userMessage.content, assistantText);
          setConversations((cs) => cs.map((c) => (c.id === conversationId ? { ...c, title } : c)));
        } catch {
          // The LLM title call can fail independently of the chat response
          // (rate limit, network hiccup) — fall back so a conversation never
          // stays stuck as "New conversation" forever.
          const fallback = userMessage.content.slice(0, FALLBACK_TITLE_LENGTH) || NEW_CONVERSATION_TITLE;
          setConversations((cs) => cs.map((c) => (c.id === conversationId ? { ...c, title: fallback } : c)));
        }
      }
    },
    [provider, model, streaming, pdfPath],
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

  const attachImage = useCallback((dataUrl: string, mimeType = "image/png") => {
    setPendingImage({ dataUrl, mimeType });
    setOpen(true);
  }, []);

  const clearPendingImage = useCallback(() => setPendingImage(null), []);

  const sendDraft = useCallback(() => {
    const text = draft;
    const image = pendingImage;
    setDraft("");
    setPendingImage(null);
    void send(text, image);
  }, [draft, pendingImage, send]);

  const selectConversation = useCallback(
    (id: string) => {
      if (streaming) return;
      setActiveId(id);
    },
    [streaming],
  );

  const startNewConversation = useCallback(() => {
    if (streaming) return;
    setActiveId(null);
  }, [streaming]);

  return {
    open,
    setOpen,
    messages,
    draft,
    setDraft,
    pendingImage,
    attachImage,
    clearPendingImage,
    streaming,
    insertText,
    explain,
    sendDraft,
    conversationsForPdf,
    activeConversationId: activeId,
    activeTitle,
    selectConversation,
    startNewConversation,
  };
}
