import type { ChatMessage } from "../../services/tauri/commands";

interface ChatMessageListProps {
  messages: ChatMessage[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  if (messages.length === 0) {
    return <p className="chat-empty">Select text in the document and choose "Explain", or ask a question below.</p>;
  }

  return (
    <div className="chat-message-list">
      {messages.map((message, i) => (
        <div key={i} className={`chat-message chat-message-${message.role}`}>
          <div className="chat-message-bubble">
            {message.image && (
              <img
                className="chat-message-image"
                src={`data:${message.image.mimeType};base64,${message.image.data}`}
                alt="Screenshot"
              />
            )}
            {message.content && <div>{message.content}</div>}
            {!message.image && !message.content && "…"}
          </div>
        </div>
      ))}
    </div>
  );
}
