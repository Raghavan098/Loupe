import { useRef, useState } from "react";
import "./App.css";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { PdfViewer } from "./components/PdfViewer/PdfViewer";
import { ChatPanel } from "./components/Chat/ChatPanel";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { SelectionToolbar } from "./components/SelectionToolbar/SelectionToolbar";
import { ScreenshotPopup } from "./components/ScreenshotPopup/ScreenshotPopup";
import { usePdfDocument } from "./hooks/usePdfDocument";
import { useSettings } from "./hooks/useSettings";
import { useChatPanel } from "./hooks/useChatPanel";
import { useSelectionToolbar } from "./hooks/useSelectionToolbar";
import { useScreenshotCapture } from "./hooks/useScreenshotCapture";

const DEFAULT_SCALE = 1.25;

function App() {
  const { doc, fileName, path, numPages, version, loading, error, openPath } = usePdfDocument();
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settings = useSettings();
  const chat = useChatPanel(path, settings.activeProvider, settings.model);

  const viewerRef = useRef<HTMLDivElement>(null);
  const toolbar = useSelectionToolbar(viewerRef);
  const screenshot = useScreenshotCapture();

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        scale={scale}
        onOpenPath={openPath}
        onScaleChange={setScale}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleChat={() => chat.setOpen((o) => !o)}
        screenshotMode={screenshot.active}
        onToggleScreenshotMode={screenshot.toggle}
      />
      <div className="body-layout">
        <div className="viewer-container" ref={viewerRef}>
          {error && <p className="viewer-message viewer-error">{error}</p>}
          {loading && <p className="viewer-message">Loading…</p>}
          {!loading && !error && doc && (
            <PdfViewer
              key={version}
              doc={doc}
              numPages={numPages}
              scale={scale}
              screenshotMode={screenshot.active}
              onCapture={screenshot.handleCapture}
            />
          )}
          {!loading && !error && !doc && (
            <p className="viewer-message">Open a PDF to get started.</p>
          )}
        </div>
        {chat.open && <ChatPanel chat={chat} />}
      </div>
      {toolbar && !screenshot.active && (
        <SelectionToolbar
          {...toolbar}
          onInsert={() => chat.insertText(toolbar.text)}
          onExplain={() => chat.explain(toolbar.text)}
        />
      )}
      {screenshot.capture && (
        <ScreenshotPopup
          {...screenshot.capture}
          onAddToChat={() => {
            chat.attachImage(screenshot.capture!.dataUrl);
            screenshot.clearCapture();
          }}
          onDismiss={screenshot.clearCapture}
        />
      )}
      {settingsOpen && (
        <SettingsModal settings={settings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

export default App;
