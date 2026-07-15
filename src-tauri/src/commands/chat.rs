use crate::llm::{ChatMessage, ChatStreamEvent};
use crate::settings::Provider;
use tauri::ipc::Channel;

#[tauri::command]
pub async fn send_chat_message(
    provider: Provider,
    model: String,
    messages: Vec<ChatMessage>,
    on_event: Channel<ChatStreamEvent>,
) -> Result<(), String> {
    crate::llm::stream_chat(provider, model, messages, on_event).await
}

#[tauri::command]
pub async fn generate_conversation_title(
    provider: Provider,
    model: String,
    first_user_message: String,
    first_assistant_message: String,
) -> Result<String, String> {
    crate::llm::generate_title(provider, model, first_user_message, first_assistant_message).await
}
