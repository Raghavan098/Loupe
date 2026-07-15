use super::{sse, ChatMessage, ChatStreamEvent, EventSink};
use serde_json::Value;

/// Gemini uses "model" instead of "assistant" for prior AI turns.
fn gemini_role(role: &str) -> &'static str {
    if role == "assistant" {
        "model"
    } else {
        "user"
    }
}

/// Builds the `parts` array for one message: a text part when `content` is
/// non-empty, plus an inline-data image part when an image is attached.
/// Gemini's `inline_data.data` wants a bare base64 string (no `data:` prefix).
fn build_parts(m: &ChatMessage) -> Vec<Value> {
    let mut parts = Vec::new();
    if !m.content.is_empty() {
        parts.push(serde_json::json!({ "text": m.content }));
    }
    if let Some(image) = &m.image {
        parts.push(serde_json::json!({
            "inline_data": { "mime_type": image.mime_type, "data": image.data },
        }));
    }
    parts
}

/// Streams a chat completion from the Gemini `streamGenerateContent` API,
/// forwarding each `candidates[0].content.parts[0].text` chunk as a
/// `ChatStreamEvent::Delta`.
pub async fn stream(
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    sink: &dyn EventSink,
) -> Result<(), String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    );

    let body = serde_json::json!({
        "contents": messages.iter().map(|m| serde_json::json!({
            "role": gemini_role(&m.role),
            "parts": build_parts(m),
        })).collect::<Vec<_>>(),
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let response = super::check_status(response, "Google").await?;

    sse::for_each_sse_data_line(response, |data| {
        let Ok(value) = serde_json::from_str::<Value>(data) else {
            return;
        };
        if let Some(text) = extract_delta(&value) {
            sink.send(ChatStreamEvent::Delta { text });
        }
    })
    .await
}

/// Pulls the incremental text out of one Gemini `GenerateContentResponse`
/// chunk's `candidates[0].content.parts[0].text`.
fn extract_delta(value: &Value) -> Option<String> {
    value
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_candidate_text() {
        let value = serde_json::json!({
            "candidates": [{
                "content": { "role": "model", "parts": [{ "text": "Hello" }] },
                "index": 0
            }]
        });
        assert_eq!(extract_delta(&value), Some("Hello".to_string()));
    }

    #[test]
    fn ignores_missing_candidates() {
        let value = serde_json::json!({ "candidates": [] });
        assert_eq!(extract_delta(&value), None);
    }

    #[test]
    fn maps_assistant_role_to_model() {
        assert_eq!(gemini_role("assistant"), "model");
        assert_eq!(gemini_role("user"), "user");
    }

    #[test]
    fn build_parts_text_only() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "hello".to_string(),
            image: None,
        };
        assert_eq!(build_parts(&m), vec![serde_json::json!({ "text": "hello" })]);
    }

    #[test]
    fn build_parts_with_image_uses_bare_base64() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "what is this?".to_string(),
            image: Some(super::super::ChatImage {
                mime_type: "image/png".to_string(),
                data: "AAAA".to_string(),
            }),
        };
        assert_eq!(
            build_parts(&m),
            vec![
                serde_json::json!({ "text": "what is this?" }),
                serde_json::json!({ "inline_data": { "mime_type": "image/png", "data": "AAAA" } }),
            ]
        );
    }

    #[test]
    fn build_parts_image_only_omits_text_part() {
        let m = ChatMessage {
            role: "user".to_string(),
            content: "".to_string(),
            image: Some(super::super::ChatImage {
                mime_type: "image/png".to_string(),
                data: "AAAA".to_string(),
            }),
        };
        assert_eq!(
            build_parts(&m),
            vec![serde_json::json!({ "inline_data": { "mime_type": "image/png", "data": "AAAA" } })]
        );
    }
}
