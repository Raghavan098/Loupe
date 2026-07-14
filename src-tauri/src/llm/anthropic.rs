use super::{sse, ChatMessage, ChatStreamEvent};
use serde_json::Value;
use tauri::ipc::Channel;

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_TOKENS: u32 = 4096;

/// Streams a chat completion from the Anthropic Messages API, forwarding each
/// `content_block_delta` / `text_delta` chunk as a `ChatStreamEvent::Delta`.
pub async fn stream(
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    channel: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "stream": true,
        "messages": messages.iter().map(|m| serde_json::json!({
            "role": m.role,
            "content": m.content,
        })).collect::<Vec<_>>(),
    });

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let response = super::check_status(response, "Anthropic").await?;

    sse::for_each_sse_data_line(response, |data| {
        let Ok(value) = serde_json::from_str::<Value>(data) else {
            return;
        };
        if let Some(text) = extract_delta(&value) {
            let _ = channel.send(ChatStreamEvent::Delta { text });
        }
    })
    .await
}

/// Pulls the incremental text out of one Anthropic SSE event, if it's a
/// `content_block_delta` / `text_delta` chunk. Every other event type
/// (`message_start`, `content_block_stop`, `message_stop`, `ping`, ...) is
/// ignored.
fn extract_delta(value: &Value) -> Option<String> {
    if value.get("type").and_then(Value::as_str) != Some("content_block_delta") {
        return None;
    }
    value
        .get("delta")
        .and_then(|d| d.get("text"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_text_delta() {
        let value = serde_json::json!({
            "type": "content_block_delta",
            "index": 0,
            "delta": { "type": "text_delta", "text": "Hello" }
        });
        assert_eq!(extract_delta(&value), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_other_event_types() {
        for value in [
            serde_json::json!({"type": "message_start"}),
            serde_json::json!({"type": "content_block_stop", "index": 0}),
            serde_json::json!({"type": "message_stop"}),
            serde_json::json!({"type": "ping"}),
        ] {
            assert_eq!(extract_delta(&value), None);
        }
    }
}
