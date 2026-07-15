import { useState } from "react";
import type { useChatPanel } from "../../hooks/useChatPanel";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { ConversationHistory } from "./ConversationHistory";

interface ChatPanelProps {
  chat: ReturnType<typeof useChatPanel>;
}

export function ChatPanel({ chat }: ChatPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div className="chat-panel-heading">
          <h2>Chat</h2>
          <span className="chat-panel-subtitle">{chat.activeTitle}</span>
        </div>
        <div className="chat-panel-header-actions">
          <button
            className="chat-history-button"
            onClick={() => chat.startNewConversation()}
            disabled={chat.streaming}
            aria-label="New conversation"
            title="New conversation"
          >
            +
          </button>
          <div className="chat-history-anchor">
            <button
              className="chat-history-button"
              onClick={() => setHistoryOpen((o) => !o)}
              disabled={chat.streaming}
              aria-label="Conversation history"
              title="Conversation history"
            >
              🕘
            </button>
            {historyOpen && (
              <ConversationHistory
                conversations={chat.conversationsForPdf}
                activeConversationId={chat.activeConversationId}
                onSelect={(id) => {
                  chat.selectConversation(id);
                  setHistoryOpen(false);
                }}
                onDismiss={() => setHistoryOpen(false)}
              />
            )}
          </div>
          <button
            className="modal-close"
            onClick={() => chat.setOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
      </div>
      <div className="chat-panel-body">
        <ChatMessageList messages={chat.messages} />
      </div>
      <ChatInput
        draft={chat.draft}
        onDraftChange={chat.setDraft}
        onSend={chat.sendDraft}
        disabled={chat.streaming}
        pendingImage={chat.pendingImage}
        onRemoveImage={chat.clearPendingImage}
      />
    </div>
  );
}
