import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

export interface SelectionToolbarState {
  text: string;
  top: number;
  left: number;
}

const TOOLBAR_OFFSET = 40; // px above the selection
const VIEWPORT_MARGIN = 8; // don't render flush against the window edge

export function useSelectionToolbar(containerRef: RefObject<HTMLElement | null>) {
  const [toolbar, setToolbar] = useState<SelectionToolbarState | null>(null);

  const update = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    if (!selection || selection.rangeCount === 0 || !text) {
      setToolbar(null);
      return;
    }

    // Ignore selections outside the PDF viewer (e.g. inside the chat panel).
    const anchor = selection.anchorNode;
    if (!anchor || !containerRef.current?.contains(anchor)) {
      setToolbar(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null);
      return;
    }

    setToolbar({
      text,
      top: Math.max(VIEWPORT_MARGIN, rect.top - TOOLBAR_OFFSET),
      left: rect.left + rect.width / 2,
    });
  }, [containerRef]);

  useEffect(() => {
    // "mouseup" catches the end of a drag-selection; "selectionchange" also
    // catches keyboard-driven selection (shift+arrow) that mouseup would miss.
    document.addEventListener("mouseup", update);
    document.addEventListener("selectionchange", update);
    return () => {
      document.removeEventListener("mouseup", update);
      document.removeEventListener("selectionchange", update);
    };
  }, [update]);

  return toolbar;
}
