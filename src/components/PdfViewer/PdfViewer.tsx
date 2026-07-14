import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "./PdfPage";

interface PdfViewerProps {
  doc: PDFDocumentProxy;
  numPages: number;
  scale: number;
}

export function PdfViewer({ doc, numPages, scale }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.style.setProperty("--scale-factor", String(scale));
  }, [scale]);

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className="pdfViewer" ref={containerRef}>
      {pageNumbers.map((pageNumber) => (
        <PdfPage key={pageNumber} doc={doc} pageNumber={pageNumber} scale={scale} />
      ))}
    </div>
  );
}
