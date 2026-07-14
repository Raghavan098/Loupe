import { invoke } from "@tauri-apps/api/core";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

export async function loadPdfFromPath(path: string): Promise<LoadedPdf> {
  const bytes = await invoke<number[]>("read_pdf_bytes", { path });
  const loadingTask = getDocument({ data: new Uint8Array(bytes) });
  const doc = await loadingTask.promise;
  return { doc, destroy: () => loadingTask.destroy() };
}
