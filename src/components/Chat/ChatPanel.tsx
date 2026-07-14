import type { useChatPanel } from "../../hooks/useChatPanel";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  chat: ReturnType<typeof useChatPanel>;
}

export function ChatPanel({ chat }: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <h2>Chat</h2>
        <button
          className="modal-close"
          onClick={() => chat.setOpen(false)}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>
      <div className="chat-panel-body">
        <ChatMessageList messages={chat.messages} />
      </div>
      <ChatInput
        draft={chat.draft}
        onDraftChange={chat.setDraft}
        onSend={chat.sendDraft}
        disabled={chat.streaming}
      />
    </div>
  );
}
