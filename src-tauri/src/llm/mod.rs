pub mod anthropic;
pub mod google;
pub mod openai;
mod sse;

use crate::settings::{self, Provider};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

/// Normalized streaming event sent to the frontend, regardless of which
/// provider produced it. Keep this in sync with the TS discriminated union
/// in `src/services/tauri/commands.ts`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatStreamEvent {
    Delta { text: String },
    Done,
    Error { message: String },
}

/// A base64-encoded image attached to a chat message (e.g. a PDF-page
/// screenshot). Keep this in sync with `ChatImage` in
/// `src/services/tauri/commands.ts`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatImage {
    pub mime_type: String,
    /// Base64-encoded image bytes, without a `data:` URL prefix.
    pub data: String,
}

/// Keep this in sync with `ChatMessage` in `src/services/tauri/commands.ts`.
#[derive(Debug, Clone, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub image: Option<ChatImage>,
}

/// Looks up the active provider's key, dispatches to its streaming
/// implementation, and always terminates the channel with a `Done` or
/// `Error` event so the frontend never waits on a stream that silently stops.
pub async fn stream_chat(
    provider: Provider,
    model: String,
    messages: Vec<ChatMessage>,
    channel: Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let result = run(provider, model, messages, &channel).await;

    match &result {
        Ok(()) => {
            let _ = channel.send(ChatStreamEvent::Done);
        }
        Err(message) => {
            let _ = channel.send(ChatStreamEvent::Error {
                message: message.clone(),
            });
        }
    }

    result
}

async fn run(
    provider: Provider,
    model: String,
    messages: Vec<ChatMessage>,
    channel: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let api_key = settings::get_key(provider)?;
    match provider {
        Provider::Anthropic => anthropic::stream(&api_key, &model, &messages, channel).await,
        Provider::OpenAi => openai::stream(&api_key, &model, &messages, channel).await,
        Provider::Google => google::stream(&api_key, &model, &messages, channel).await,
    }
}

/// Shared HTTP-status handling for all providers: maps common failure codes
/// to a user-facing message before the caller touches the streamed body.
pub(crate) async fn check_status(
    response: reqwest::Response,
    provider_name: &str,
) -> Result<reqwest::Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let message = match status.as_u16() {
        401 => format!("Invalid API key for {provider_name}. Check your key in Settings."),
        429 => format!("Rate limited by {provider_name}. Try again in a moment."),
        500..=599 => format!("{provider_name} is temporarily unavailable. Try again shortly."),
        _ => {
            let body = response.text().await.unwrap_or_default();
            format!("{provider_name} returned an error ({status}): {body}")
        }
    };
    Err(message)
}
