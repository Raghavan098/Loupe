use super::{sse, ChatMessage, ChatStreamEvent};
use serde_json::Value;
use tauri::ipc::Channel;

/// Builds the `content` field for one message: a plain string when there's no
/// image, or an array of content blocks (text + image) when there is.
/// Anthropic's image blocks take a bare base64 string (no `data:` prefix).
fn build_content(m: &ChatMessage) -> Value {
    let Some(image) = &m.image else {
        return Value::String(m.content.clone());
    };

    let mut blocks = Vec::new();
    if !m.content.is_empty() {
        blocks.push(serde_json::json!({ "type": "text", "text": m.content }));
    }
    blocks.push(serde_json::json!({
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": image.mime_type,
            "data": image.data,
        },
    }));
    Value::Array(blocks)
}

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
            "content": build_content(m),
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

    #[test]
    fn build_content_plain_string_when_no_image() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "hello".to_string(),
            image: None,
        };
        assert_eq!(build_content(&m), Value::String("hello".to_string()));
    }

    #[test]
    fn build_content_with_image_and_text() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "what is this?".to_string(),
            image: Some(super::super::ChatImage {
                mime_type: "image/png".to_string(),
                data: "AAAA".to_string(),
            }),
        };
        assert_eq!(
            build_content(&m),
            serde_json::json!([
                { "type": "text", "text": "what is this?" },
                { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "AAAA" } },
            ])
        );
    }

    #[test]
    fn build_content_image_only_omits_text_block() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "".to_string(),
            image: Some(super::super::ChatImage {
                mime_type: "image/png".to_string(),
                data: "AAAA".to_string(),
            }),
        };
        assert_eq!(
            build_content(&m),
            serde_json::json!([
                { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "AAAA" } },
            ])
        );
    }
}
