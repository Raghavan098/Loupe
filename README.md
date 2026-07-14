# Loupe

An open source, local-first PDF reader with LLM-powered highlight explanations and screenshot-based explanations for images, diagrams, and equations.

PDFs never leave your disk — no upload to any third-party server. Bring your own API key (Anthropic, OpenAI, or Google/Gemini, with optional local Ollama support planned), a proper warm dark mode instead of naive color inversion, and local persistence of highlights/notes tied to each document.

## Status

Early development. Currently: PDF rendering foundation (load a PDF, render via PDF.js, selectable text layer), a Settings screen for saving a per-provider API key, and a streaming chat panel — select text in the document and choose "Insert into chat" or "Explain" to get an LLM response. Dark mode, screenshot-to-explain, and local persistence are being built next, one at a time.

## Tech stack

- **Shell**: Tauri v2, Rust backend
- **Frontend**: React + TypeScript, Vite
- **PDF rendering**: PDF.js (`pdfjs-dist`)
- **Local storage**: SQLite, per-document highlights/explanations/notes
- **API keys**: stored via the OS keychain (Rust `keyring` crate), one entry per provider, never returned to the webview
- **LLM calls**: made only from the Rust backend (Anthropic, OpenAI, Google/Gemini), streamed to the frontend via a Tauri IPC channel

## Development

```bash
pnpm install
pnpm tauri dev
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
