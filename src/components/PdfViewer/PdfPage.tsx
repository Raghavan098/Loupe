import { useEffect, useRef } from "react";
import { TextLayer, type PDFDocumentProxy } from "pdfjs-dist";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export function PdfPage({ doc, pageNumber, scale }: PdfPageProps) {
  const pageDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null =
      null;
    let textLayer: TextLayer | null = null;

    async function renderPage() {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const pageDiv = pageDivRef.current;
      const canvas = canvasRef.current;
      const textLayerDiv = textLayerRef.current;
      if (!pageDiv || !canvas || !textLayerDiv) return;

      const width = Math.floor(viewport.width);
      const height = Math.floor(viewport.height);

      pageDiv.style.width = `${width}px`;
      pageDiv.style.height = `${height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = width;
      canvas.height = height;

      renderTask = page.render({ canvasContext: context, canvas, viewport });
      await renderTask.promise;
      if (cancelled) return;

      textLayerDiv.replaceChildren();
      textLayerDiv.style.width = `${width}px`;
      textLayerDiv.style.height = `${height}px`;

      const textContent = await page.getTextContent();
      if (cancelled) return;

      textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
    }

    renderPage().catch((err) => {
      if (!cancelled) console.error(`Failed to render page ${pageNumber}`, err);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, scale]);

  return (
    <div className="page" ref={pageDivRef} data-page-number={pageNumber}>
      <div className="canvasWrapper">
        <canvas ref={canvasRef} />
      </div>
      <div className="textLayer" ref={textLayerRef} />
    </div>
  );
}
