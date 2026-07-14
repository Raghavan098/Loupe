import { useEffect, useState } from "react";
import type { Provider } from "../../services/tauri/commands";
import { PROVIDER_LABELS, PROVIDERS, SUGGESTED_MODELS } from "../../services/llm/providerModels";
import type { useSettings } from "../../hooks/useSettings";

interface SettingsModalProps {
  settings: ReturnType<typeof useSettings>;
  onClose: () => void;
}

export function SettingsModal({ settings, onClose }: SettingsModalProps) {
  const { activeProvider, setActiveProvider, model, setModel, configured, save, remove } =
    settings;
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A key draft for one provider should never be silently saved to another.
  useEffect(() => {
    setApiKeyDraft("");
    setError(null);
  }, [activeProvider]);

  const isConfigured = configured[activeProvider];

  const handleSave = async () => {
    if (!apiKeyDraft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await save(activeProvider, apiKeyDraft.trim());
      setApiKeyDraft("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      await remove(activeProvider);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <label className="settings-field">
          <span>Provider</span>
          <select
            value={activeProvider}
            onChange={(e) => setActiveProvider(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
                {configured[p] ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Model</span>
          <input
            list="settings-model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="settings-model-options">
            {SUGGESTED_MODELS[activeProvider].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="settings-field">
          <span>API key</span>
          <input
            type="password"
            placeholder={isConfigured ? "•••••••••••• (configured)" : "Paste your API key"}
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
          />
        </label>

        {error && <p className="settings-error">{error}</p>}

        <div className="settings-actions">
          <button onClick={handleSave} disabled={saving || !apiKeyDraft.trim()}>
            Save key
          </button>
          {isConfigured && (
            <button onClick={handleRemove} disabled={saving} className="settings-remove">
              Remove key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
