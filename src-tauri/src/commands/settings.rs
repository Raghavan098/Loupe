use crate::settings::{self, Provider};

#[tauri::command]
pub fn save_api_key(provider: Provider, api_key: String) -> Result<(), String> {
    settings::save_key(provider, &api_key)
}

#[tauri::command]
pub fn delete_api_key(provider: Provider) -> Result<(), String> {
    settings::delete_key(provider)
}

#[tauri::command]
pub fn has_api_key(provider: Provider) -> Result<bool, String> {
    settings::has_key(provider)
}
