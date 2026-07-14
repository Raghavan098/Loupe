import type { KeyboardEvent } from "react";

interface ChatInputProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export function ChatInput({ draft, onDraftChange, onSend, disabled }: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && draft.trim()) onSend();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about the document…"
        rows={2}
      />
      <button onClick={onSend} disabled={disabled || !draft.trim()}>
        Send
      </button>
    </div>
  );
}
