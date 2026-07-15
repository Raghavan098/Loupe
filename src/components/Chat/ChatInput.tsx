import type { KeyboardEvent } from "react";

interface ChatInputProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  pendingImage: { dataUrl: string; mimeType: string } | null;
  onRemoveImage: () => void;
}

export function ChatInput({
  draft,
  onDraftChange,
  onSend,
  disabled,
  pendingImage,
  onRemoveImage,
}: ChatInputProps) {
  const canSend = !disabled && (!!draft.trim() || !!pendingImage);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="chat-input-wrapper">
      {pendingImage && (
        <div className="chat-image-chip">
          <img src={pendingImage.dataUrl} alt="Attached screenshot" />
          <button className="chat-image-chip-remove" onClick={onRemoveImage} aria-label="Remove image">
            ×
          </button>
        </div>
      )}
      <div className="chat-input">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the document…"
          rows={2}
        />
        <button onClick={onSend} disabled={!canSend}>
          Send
        </button>
      </div>
    </div>
  );
}
