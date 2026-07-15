import { useEffect, useRef } from "react";

interface ScreenshotPopupProps {
  dataUrl: string;
  top: number;
  left: number;
  onAddToChat: () => void;
  onDismiss: () => void;
}

export function ScreenshotPopup({ dataUrl, top, left, onAddToChat, onDismiss }: ScreenshotPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  return (
    <div ref={ref} className="screenshot-popup" style={{ top, left }}>
      <img src={dataUrl} alt="Captured selection" />
      <button onClick={onAddToChat}>Add to chat</button>
    </div>
  );
}
