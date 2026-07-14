import { useCallback, useEffect, useState } from "react";
import { deleteApiKey, hasApiKey, saveApiKey, type Provider } from "../services/tauri/commands";
import { DEFAULT_MODEL, PROVIDERS } from "../services/llm/providerModels";

const ACTIVE_PROVIDER_KEY = "loupe.activeProvider";
const modelStorageKey = (provider: Provider) => `loupe.model.${provider}`;

function readActiveProvider(): Provider {
  const stored = localStorage.getItem(ACTIVE_PROVIDER_KEY);
  return (PROVIDERS as string[]).includes(stored ?? "") ? (stored as Provider) : "anthropic";
}

function readModel(provider: Provider): string {
  return localStorage.getItem(modelStorageKey(provider)) ?? DEFAULT_MODEL[provider];
}

export function useSettings() {
  const [activeProvider, setActiveProviderState] = useState<Provider>(readActiveProvider);
  const [model, setModelState] = useState<string>(() => readModel(readActiveProvider()));
  const [configured, setConfigured] = useState<Record<Provider, boolean>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p, false])) as Record<Provider, boolean>,
  );

  const refresh = useCallback(async () => {
    const entries = await Promise.all(PROVIDERS.map((p) => hasApiKey(p)));
    setConfigured(
      Object.fromEntries(PROVIDERS.map((p, i) => [p, entries[i]])) as Record<Provider, boolean>,
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveProvider = useCallback((provider: Provider) => {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
    setActiveProviderState(provider);
    setModelState(readModel(provider));
  }, []);

  const setModel = useCallback(
    (nextModel: string) => {
      localStorage.setItem(modelStorageKey(activeProvider), nextModel);
      setModelState(nextModel);
    },
    [activeProvider],
  );

  const save = useCallback(
    async (provider: Provider, apiKey: string) => {
      await saveApiKey(provider, apiKey);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (provider: Provider) => {
      await deleteApiKey(provider);
      await refresh();
    },
    [refresh],
  );

  return { activeProvider, setActiveProvider, model, setModel, configured, save, remove };
}
