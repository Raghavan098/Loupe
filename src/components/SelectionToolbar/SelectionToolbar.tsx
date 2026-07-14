import type { SelectionToolbarState } from "../../hooks/useSelectionToolbar";

interface SelectionToolbarProps extends SelectionToolbarState {
  onInsert: () => void;
  onExplain: () => void;
}

export function SelectionToolbar({ top, left, onInsert, onExplain }: SelectionToolbarProps) {
  return (
    <div
      className="selection-toolbar"
      style={{ top, left }}
      // Selecting a button click would otherwise clear window.getSelection()
      // before the click handler runs on some platforms.
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={onInsert}>Insert into chat</button>
      <button onClick={onExplain}>Explain</button>
    </div>
  );
}
