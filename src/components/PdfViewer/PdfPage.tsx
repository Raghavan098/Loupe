import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { RenderingCancelledException, type PDFDocumentProxy } from "pdfjs-dist";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  screenshotMode: boolean;
  onCapture: (dataUrl: string, pos: { top: number; left: number }) => void;
}

// Below this size (in CSS px) a drag is treated as a click, not a capture —
// avoids firing a 1x1 crop when the user just meant to click on the page.
const MIN_DRAG_SIZE = 6;
const POPUP_OFFSET = 40; // px above the captured region

interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PdfPage({ doc, pageNumber, scale, screenshotMode, onCapture }: PdfPageProps) {
  const pageDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [measured, setMeasured] = useState(false);
  const [visible, setVisible] = useState(false);

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);

  // Phase 1 — set the placeholder dimensions immediately so the scroll
  // container has the correct layout before any canvas is painted.
  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const pageDiv = pageDivRef.current;
      if (pageDiv) {
        pageDiv.style.width = `${Math.floor(viewport.width)}px`;
        pageDiv.style.height = `${Math.floor(viewport.height)}px`;
        setMeasured(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale]);

  // Phase 2 — track whether the page is near the viewport (within 400 px).
  // This must not start before the placeholder has its real size: zero-height
  // placeholders all "intersect" the viewport on mount, which would mark every
  // page of a large document visible at once.
  useEffect(() => {
    const div = pageDivRef.current;
    if (!div || !measured) return;

    // Root must be the scroll container: with the default (viewport) root the
    // rootMargin is defeated by the container's own clipping, so pages would
    // only start rendering once already on-screen.
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: div.closest(".viewer-container"), rootMargin: "400px" },
    );
    observer.observe(div);
    return () => observer.disconnect();
  }, [measured]);

  // Phase 3 — render canvas + text layer while visible; release them when the
  // page scrolls far away.  Keeping every canvas alive exhausts the WebView's
  // canvas-memory budget on large documents, after which new canvases
  // silently paint blank.  Re-runs whenever scale changes (so zoom always
  // re-renders).
  useEffect(() => {
    const pageDiv = pageDivRef.current;
    const canvas = canvasRef.current;
    if (!visible || !pageDiv || !canvas) return;

    let cancelled = false;
    let renderTask: ReturnType<
      Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]
    > | null = null;
    let textLayerBuilder: TextLayerBuilder | null = null;

    async function renderPage() {
      const page = await doc.getPage(pageNumber);
      if (cancelled || !pageDiv || !canvas) return;

      const viewport = page.getViewport({ scale });
      const width = Math.floor(viewport.width);
      const height = Math.floor(viewport.height);

      // Sync the page placeholder with the real viewport size.
      pageDiv.style.width = `${width}px`;
      pageDiv.style.height = `${height}px`;

      // Reset canvas to the correct resolution.
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = width;
      canvas.height = height;

      // Render the PDF page into the canvas.
      renderTask = page.render({ canvasContext: ctx, canvas, viewport });
      try {
        await renderTask.promise;
      } catch (err) {
        if (err instanceof RenderingCancelledException) return;
        throw err;
      }
      if (cancelled) return;

      // Build the text layer.  TextLayerBuilder (rather than the raw
      // TextLayer) also wires up the endOfContent/selecting machinery —
      // without it the browser refuses to extend a drag selection across the
      // transformed text spans, so text can't be highlighted with the mouse.
      textLayerBuilder = new TextLayerBuilder({
        pdfPage: page,
        onAppend: (div: HTMLDivElement) => pageDiv.append(div),
      });
      // `images` is optional at runtime; the upstream .d.ts just doesn't
      // mark it as such.
      await textLayerBuilder.render({ viewport, images: undefined! });
    }

    renderPage().catch((err) => {
      if (!cancelled) console.error(`Page ${pageNumber} render error:`, err);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayerBuilder?.cancel();
      textLayerBuilder?.div.remove();
      // Drop the canvas backing store so hidden pages stop counting against
      // the canvas-memory budget.
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [doc, pageNumber, scale, visible]);

  // Pointer Capture keeps routing move/up events to this page's overlay even
  // if the drag leaves its bounds, so clamping to [0, pageWidth/Height] below
  // clamps the capture to the page the drag started on for free — no
  // cross-page hit-testing needed.
  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width);
    const y = clamp(e.clientY - r.top, 0, r.height);
    setDragStart({ x, y });
    setDragRect({ x, y, w: 0, h: 0 });
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStart) return;
      const r = e.currentTarget.getBoundingClientRect();
      const x = clamp(e.clientX - r.left, 0, r.width);
      const y = clamp(e.clientY - r.top, 0, r.height);
      setDragRect({
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        w: Math.abs(x - dragStart.x),
        h: Math.abs(y - dragStart.y),
      });
    },
    [dragStart],
  );

  const resetDrag = useCallback(() => {
    setDragStart(null);
    setDragRect(null);
  }, []);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStart || !dragRect) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const rect = dragRect;
      resetDrag();

      // A near-zero-size drag is treated as a click, not a capture — no-op,
      // screenshot mode stays active so the user can try again.
      if (rect.w < MIN_DRAG_SIZE || rect.h < MIN_DRAG_SIZE) return;

      const canvas = canvasRef.current;
      // Canvas is zeroed while the page is scrolled out of view (see the
      // render effect's cleanup above) — guard against cropping a blank
      // canvas if the page went out of view mid-drag.
      if (!canvas || canvas.width === 0 || canvas.height === 0) return;

      // Canvas pixels are set directly from Math.floor(viewport.width/height)
      // with no devicePixelRatio multiplier anywhere in this codebase, so
      // drag-rect CSS px map 1:1 to canvas pixel coordinates.
      const cropWidth = Math.round(rect.w);
      const cropHeight = Math.round(rect.h);
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        canvas,
        Math.round(rect.x),
        Math.round(rect.y),
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );

      const pageRect = e.currentTarget.getBoundingClientRect();
      onCapture(cropCanvas.toDataURL("image/png"), {
        top: Math.max(8, pageRect.top + rect.y - POPUP_OFFSET),
        left: pageRect.left + rect.x + rect.w / 2,
      });
    },
    [dragStart, dragRect, onCapture, resetDrag],
  );

  return (
    <div className="page" ref={pageDivRef} data-page-number={pageNumber}>
      <div className="canvasWrapper">
        <canvas ref={canvasRef} />
      </div>
      {screenshotMode && visible && (
        <div
          className="screenshot-overlay"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={resetDrag}
        >
          {dragRect && (
            <div
              className="screenshot-drag-rect"
              style={{ left: dragRect.x, top: dragRect.y, width: dragRect.w, height: dragRect.h }}
            />
          )}
        </div>
      )}
    </div>
  );
}
