import { useState } from "react";
import { pickPdfPath } from "../../services/tauri/commands";

interface ToolbarProps {
  fileName: string | null;
  scale: number;
  onOpenPath: (path: string) => void;
  onScaleChange: (scale: number) => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
  screenshotMode: boolean;
  onToggleScreenshotMode: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export function Toolbar({
  fileName,
  scale,
  onOpenPath,
  onScaleChange,
  onOpenSettings,
  onToggleChat,
  screenshotMode,
  onToggleScreenshotMode,
}: ToolbarProps) {
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      const path = await pickPdfPath();
      if (path) onOpenPath(path);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="toolbar">
      <button onClick={handleOpen} disabled={opening}>
        {opening ? "Opening…" : "Open PDF"}
      </button>
      <span className="toolbar-filename">{fileName ?? "No document open"}</span>
      <div className="toolbar-zoom">
        <button
          onClick={() => onScaleChange(Math.max(MIN_SCALE, scale - SCALE_STEP))}
          disabled={scale <= MIN_SCALE}
        >
          −
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          onClick={() => onScaleChange(Math.min(MAX_SCALE, scale + SCALE_STEP))}
          disabled={scale >= MAX_SCALE}
        >
          +
        </button>
      </div>
      <button
        className={screenshotMode ? "toolbar-toggle active" : "toolbar-toggle"}
        aria-pressed={screenshotMode}
        title="Drag a box over the document to capture a screenshot"
        onClick={onToggleScreenshotMode}
      >
        Screenshot
      </button>
      <button onClick={onToggleChat}>Chat</button>
      <button onClick={onOpenSettings}>Settings</button>
    </div>
  );
}
