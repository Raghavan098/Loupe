import { useEffect, useRef, useState } from "react";
import { RenderingCancelledException, type PDFDocumentProxy } from "pdfjs-dist";
import { TextLayerBuilder } from "pdfjs-dist/web/pdf_viewer.mjs";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export function PdfPage({ doc, pageNumber, scale }: PdfPageProps) {
  const pageDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [measured, setMeasured] = useState(false);
  const [visible, setVisible] = useState(false);

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

  return (
    <div className="page" ref={pageDivRef} data-page-number={pageNumber}>
      <div className="canvasWrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
