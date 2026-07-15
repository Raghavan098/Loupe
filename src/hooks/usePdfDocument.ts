import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfFromPath, type LoadedPdf } from "../services/pdf/pdfLoader";

interface PdfDocumentState {
  doc: PDFDocumentProxy | null;
  fileName: string | null;
  /** Absolute path of the currently open PDF; the association key for conversations. */
  path: string | null;
  numPages: number;
  version: number;
  loading: boolean;
  error: string | null;
}

const initialState: PdfDocumentState = {
  doc: null,
  fileName: null,
  path: null,
  numPages: 0,
  version: 0,
  loading: false,
  error: null,
};

export function usePdfDocument() {
  const [state, setState] = useState<PdfDocumentState>(initialState);
  const loadedRef = useRef<LoadedPdf | null>(null);

  const openPath = useCallback(async (path: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const previous = loadedRef.current;
    try {
      const loaded = await loadPdfFromPath(path);
      loadedRef.current = loaded;
      const fileName = path.split(/[\\/]/).pop() ?? path;
      setState((s) => ({
        doc: loaded.doc,
        fileName,
        path,
        numPages: loaded.doc.numPages,
        version: s.version + 1,
        loading: false,
        error: null,
      }));
      await previous?.destroy();
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: String(err) }));
    }
  }, []);

  useEffect(() => {
    return () => {
      loadedRef.current?.destroy();
    };
  }, []);

  return { ...state, openPath };
}
