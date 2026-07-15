import { useEffect, useRef } from "react";
import type { Conversation } from "../../types/conversation";

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ConversationHistory({
  conversations,
  activeConversationId,
  onSelect,
  onDismiss,
}: ConversationHistoryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  return (
    <div ref={ref} className="conversation-history-popover">
      {conversations.length === 0 ? (
        <p className="conversation-history-empty">No conversations yet for this PDF.</p>
      ) : (
        <ul className="conversation-history-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                className={
                  c.id === activeConversationId
                    ? "conversation-history-item active"
                    : "conversation-history-item"
                }
                onClick={() => onSelect(c.id)}
              >
                <span className="conversation-history-item-title">{c.title}</span>
                <span className="conversation-history-item-time">{formatRelativeTime(c.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
