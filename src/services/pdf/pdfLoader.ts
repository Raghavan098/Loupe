import { invoke } from "@tauri-apps/api/core";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

export async function loadPdfFromPath(path: string): Promise<LoadedPdf> {
  const bytes = await invoke<number[]>("read_pdf_bytes", { path });
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    // Runtime assets served/copied by vite-plugin-static-copy (see
    // vite.config.ts).  Without wasmUrl the JBIG2/JPX wasm decoders can't
    // load and scanned PDFs render as blank pages.
    wasmUrl: "/pdfjs/wasm/",
    iccUrl: "/pdfjs/iccs/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  const doc = await loadingTask.promise;
  return { doc, destroy: () => loadingTask.destroy() };
}
