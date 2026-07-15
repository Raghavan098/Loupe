mod commands;
mod llm;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::pdf::read_pdf_bytes,
            commands::settings::save_api_key,
            commands::settings::delete_api_key,
            commands::settings::has_api_key,
            commands::chat::send_chat_message,
            commands::chat::generate_conversation_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
