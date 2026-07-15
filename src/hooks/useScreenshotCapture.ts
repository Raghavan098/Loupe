import { useCallback, useState } from "react";

export interface ScreenshotCaptureState {
  dataUrl: string;
  top: number;
  left: number;
}

/**
 * Owns "screenshot mode" (a toolbar-driven toggle, unlike text selection
 * which has no explicit mode) and the most recently captured region, if any.
 * `toggle` is exposed standalone so a future keyboard shortcut can drive it
 * directly without restructuring this hook.
 */
export function useScreenshotCapture() {
  const [active, setActive] = useState(false);
  const [capture, setCapture] = useState<ScreenshotCaptureState | null>(null);

  const toggle = useCallback(() => {
    setActive((a) => !a);
    setCapture(null);
  }, []);

  // A capture ends screenshot mode — one screenshot per activation.
  const handleCapture = useCallback((dataUrl: string, pos: { top: number; left: number }) => {
    setActive(false);
    setCapture({ dataUrl, ...pos });
  }, []);

  const clearCapture = useCallback(() => setCapture(null), []);

  return { active, toggle, capture, handleCapture, clearCapture };
}
