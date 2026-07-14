use serde::{Deserialize, Serialize};

/// Which LLM provider a stored key / chat request belongs to.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Anthropic,
    OpenAi,
    Google,
}

impl Provider {
    fn keyring_username(self) -> &'static str {
        match self {
            Provider::Anthropic => "anthropic",
            Provider::OpenAi => "openai",
            Provider::Google => "google",
        }
    }
}

/// Keychain service name under which all provider keys are stored.
const SERVICE: &str = "com.raghavan.loupe";

fn entry(provider: Provider) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, provider.keyring_username()).map_err(|e| e.to_string())
}

/// Save (or overwrite) the API key for a provider in the OS keychain.
pub fn save_key(provider: Provider, api_key: &str) -> Result<(), String> {
    let e = entry(provider)?;
    // Defensive: clear any existing entry before writing, so a stale item
    // can never linger under a mismatched value if a future backend upgrade
    // changes `set_password`'s add-vs-update semantics.
    let _ = e.delete_credential();
    e.set_password(api_key).map_err(|e| e.to_string())
}

/// Delete the stored API key for a provider. Deleting an absent key is a no-op success.
pub fn delete_key(provider: Provider) -> Result<(), String> {
    match entry(provider)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Whether an API key is currently stored for a provider (never returns the key itself).
pub fn has_key(provider: Provider) -> Result<bool, String> {
    match entry(provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Internal-only accessor for the raw API key. Deliberately `pub(crate)` and not
/// wired to any `#[tauri::command]` — only `crate::llm::stream_chat` may call this,
/// so the secret can never be returned to the renderer through a command result.
pub(crate) fn get_key(provider: Provider) -> Result<String, String> {
    entry(provider)?
        .get_password()
        .map_err(|_| "No API key configured for this provider.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Exercises the real OS keychain with a disposable service name (not the
    // app's real `SERVICE`) so it can't collide with or clobber a
    // genuinely-saved key. Run explicitly with:
    //   cargo test -p loupe --lib settings::tests -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_keychain_round_trip() {
        let e = keyring::Entry::new("com.raghavan.loupe.debugtest", "roundtrip-test").unwrap();
        println!("saving...");
        e.set_password("secret-value-123").expect("set_password failed");
        println!("saved. reading back...");
        let read_back = e.get_password().expect("get_password failed");
        println!("read back: {read_back:?}");
        assert_eq!(read_back, "secret-value-123");
        e.delete_credential().expect("delete_credential failed");
        println!("deleted. confirming gone...");
        let after_delete = e.get_password();
        println!("after delete: {after_delete:?}");
        assert!(matches!(after_delete, Err(keyring::Error::NoEntry)));
    }

    // Regression test for a real bug: without the `keyring` crate's
    // "apple-native" Cargo feature enabled, macOS silently falls back to an
    // in-memory mock backend scoped per `Entry` instance — so `save_key`
    // (which builds its own `Entry`) and `has_key` (which builds a
    // *different* `Entry`) never actually shared state. `save_api_key`
    // returned `Ok`, but `has_api_key` immediately after reported `false`.
    // Fixed by adding `features = ["apple-native"]` to Cargo.toml. Uses
    // Provider::Anthropic against the real SERVICE, so it's `#[ignore]`d —
    // run explicitly, and only when no real Anthropic key is saved.
    //   cargo test -p loupe --lib settings::tests -- --ignored --nocapture
    #[test]
    #[ignore]
    fn save_then_immediate_read_finds_the_value() {
        let provider = Provider::Anthropic;
        // First save (simulates an item possibly already existing from a
        // prior run/build).
        save_key(provider, "first-value").expect("first save_key failed");
        // Second save (the actual regression case: overwrite).
        save_key(provider, "second-value").expect("second save_key failed");
        assert!(has_key(provider).expect("has_key failed"));
        assert_eq!(get_key(provider).expect("get_key failed"), "second-value");
        delete_key(provider).expect("cleanup delete_key failed");
        assert!(!has_key(provider).expect("has_key after delete failed"));
    }
}
