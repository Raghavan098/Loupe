import { useState } from "react";
import "./App.css";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { PdfViewer } from "./components/PdfViewer/PdfViewer";
import { usePdfDocument } from "./hooks/usePdfDocument";

const DEFAULT_SCALE = 1.25;

function App() {
  const { doc, fileName, numPages, version, loading, error, openPath } = usePdfDocument();
  const [scale, setScale] = useState(DEFAULT_SCALE);

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        scale={scale}
        onOpenPath={openPath}
        onScaleChange={setScale}
      />
      <div className="viewer-container">
        {error && <p className="viewer-message viewer-error">{error}</p>}
        {loading && <p className="viewer-message">Loading…</p>}
        {!loading && !error && doc && (
          <PdfViewer key={version} doc={doc} numPages={numPages} scale={scale} />
        )}
        {!loading && !error && !doc && (
          <p className="viewer-message">Open a PDF to get started.</p>
        )}
      </div>
    </div>
  );
}

export default App;
