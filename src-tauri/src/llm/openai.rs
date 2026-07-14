use super::{sse, ChatMessage, ChatStreamEvent};
use serde_json::Value;
use tauri::ipc::Channel;

const API_URL: &str = "https://api.openai.com/v1/chat/completions";

/// Streams a chat completion from the OpenAI Chat Completions API, forwarding
/// each `choices[0].delta.content` chunk as a `ChatStreamEvent::Delta`. The
/// stream is terminated by a literal `data: [DONE]` line, which is ignored
/// here (not JSON) — `sse.rs`'s `data:`-line reader stops naturally when the
/// HTTP body ends.
pub async fn stream(
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    channel: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": messages.iter().map(|m| serde_json::json!({
            "role": m.role,
            "content": m.content,
        })).collect::<Vec<_>>(),
    });

    let client = reqwest::Client::new();
    let response = client
        .post(API_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let response = super::check_status(response, "OpenAI").await?;

    sse::for_each_sse_data_line(response, |data| {
        if data == "[DONE]" {
            return;
        }
        let Ok(value) = serde_json::from_str::<Value>(data) else {
            return;
        };
        if let Some(text) = extract_delta(&value) {
            let _ = channel.send(ChatStreamEvent::Delta { text });
        }
    })
    .await
}

/// Pulls the incremental text out of one OpenAI Chat Completions chunk's
/// `choices[0].delta.content`, if present (it's absent on the final chunk,
/// which only carries `finish_reason`).
fn extract_delta(value: &Value) -> Option<String> {
    value
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("delta"))
        .and_then(|d| d.get("content"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_delta_content() {
        let value = serde_json::json!({
            "id": "chatcmpl-1",
            "object": "chat.completion.chunk",
            "choices": [{ "index": 0, "delta": { "content": "Hello" }, "finish_reason": null }]
        });
        assert_eq!(extract_delta(&value), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_final_chunk_with_no_content() {
        let value = serde_json::json!({
            "choices": [{ "index": 0, "delta": {}, "finish_reason": "stop" }]
        });
        assert_eq!(extract_delta(&value), None);
    }
}
