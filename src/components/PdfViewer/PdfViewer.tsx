import type { CSSProperties } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "./PdfPage";

interface PdfViewerProps {
  doc: PDFDocumentProxy;
  numPages: number;
  scale: number;
}

export function PdfViewer({ doc, numPages, scale }: PdfViewerProps) {
  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  // pdf.js layer CSS derives all its sizing from --scale-factor; set it
  // inline so it is always in sync with the prop before layers render.
  const style = { "--scale-factor": String(scale) } as CSSProperties;

  return (
    <div className="pdfViewer" style={style}>
      {pageNumbers.map((pageNumber) => (
        <PdfPage key={pageNumber} doc={doc} pageNumber={pageNumber} scale={scale} />
      ))}
    </div>
  );
}
