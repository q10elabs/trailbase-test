//! Config generator for TrailBase server configuration
//!
//! Reads a template config file and an authn file, then generates:
//! - A config.textproto file with OAuth client ID inserted and <REDACTED> placeholder for client secret
//! - A secrets.textproto vault file with the OAuth client secret (client ID is in config, not vault)

use lazy_static::lazy_static;
use prost_reflect::text_format::FormatOptions;
use prost_reflect::{DescriptorPool, MessageDescriptor, ReflectMessage};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use std::process;
use std::sync::LazyLock;

// Include generated protobuf code
include!(concat!(env!("OUT_DIR"), "/config.rs"));

// Load descriptor pool from generated file descriptor set
static FILE_DESCRIPTOR_SET: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/file_descriptor_set.bin"));

static DESCRIPTOR_POOL: LazyLock<DescriptorPool> = LazyLock::new(|| {
    DescriptorPool::decode(FILE_DESCRIPTOR_SET)
        .expect("Failed to load file descriptor set")
});

lazy_static! {
    static ref VAULT_DESCRIPTOR: MessageDescriptor = DESCRIPTOR_POOL
        .get_message_by_name("config.Vault")
        .expect("Vault message descriptor not found");
    static ref FORMAT_OPTIONS: FormatOptions = FormatOptions::new().pretty(true).expand_any(true);
}

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() != 5 {
        eprintln!("Usage: {} <template-file> <authn-file> <config-output> <vault-output>", args[0]);
        eprintln!("  template-file: Path to config.textproto.template");
        eprintln!("  authn-file: Path to .authn file with OAuth credentials");
        eprintln!("  config-output: Path to write the generated config.textproto");
        eprintln!("  vault-output: Path to write the generated secrets.textproto");
        process::exit(1);
    }
    
    let template_path = &args[1];
    let authn_path = &args[2];
    let config_output_path = &args[3];
    let vault_output_path = &args[4];
    
    // Read template file
    let template = match fs::read_to_string(template_path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error reading template file '{}': {}", template_path, e);
            process::exit(1);
        }
    };
    
    // Read authn file and parse OAuth credentials
    let authn_content = match fs::read_to_string(authn_path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error reading authn file '{}': {}", authn_path, e);
            process::exit(1);
        }
    };
    
    let (client_id, client_secret) = parse_authn_file(&authn_content);
    
    // Replace <REDACTED> placeholder for client_id with actual value
    // Client secret remains <REDACTED> as it will be loaded from vault
    let config = template.replace("client_id: \"<REDACTED>\"", &format!("client_id: \"{}\"", client_id));
    
    // Generate vault file with client secret only (client ID is in config file, not vault)
    let vault_content = match generate_vault_file(&client_secret) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Error generating vault file: {}", e);
            process::exit(1);
        }
    };
    
    // Ensure vault output directory exists
    if let Some(vault_dir) = Path::new(vault_output_path).parent() {
        if let Err(e) = fs::create_dir_all(vault_dir) {
            eprintln!("Error creating vault directory '{}': {}", vault_dir.display(), e);
            process::exit(1);
        }
    }
    
    // Write config file
    match fs::write(config_output_path, config) {
        Ok(_) => {
            eprintln!("Successfully generated config file: {}", config_output_path);
        }
        Err(e) => {
            eprintln!("Error writing config file '{}': {}", config_output_path, e);
            process::exit(1);
        }
    }
    
    // Write vault file
    match fs::write(vault_output_path, vault_content) {
        Ok(_) => {
            eprintln!("Successfully generated vault file: {}", vault_output_path);
        }
        Err(e) => {
            eprintln!("Error writing vault file '{}': {}", vault_output_path, e);
            process::exit(1);
        }
    }
}

/// Parse the .authn file and extract Google OAuth credentials
fn parse_authn_file(content: &str) -> (String, String) {
    let mut client_id = None;
    let mut client_secret = None;
    
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            
            match key {
                "GOOGLE_OAUTH_CLIENT_ID" => {
                    client_id = Some(value.to_string());
                }
                "GOOGLE_OAUTH_CLIENT_SECRET" => {
                    client_secret = Some(value.to_string());
                }
                _ => {}
            }
        }
    }
    
    let client_id = client_id.unwrap_or_else(|| {
        eprintln!("Error: GOOGLE_OAUTH_CLIENT_ID not found in authn file");
        process::exit(1);
    });
    
    let client_secret = client_secret.unwrap_or_else(|| {
        eprintln!("Error: GOOGLE_OAUTH_CLIENT_SECRET not found in authn file");
        process::exit(1);
    });
    
    (client_id, client_secret)
}

/// Generate the vault textproto file with OAuth client secret
/// Note: Client ID is stored in the main config file, not in the vault,
/// because traildepot only supports loading secrets (not client IDs) from vault.
fn generate_vault_file(client_secret: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Create a Vault message with the client secret only
    let mut vault = Vault {
        secrets: HashMap::new(),
    };
    
    vault.secrets.insert(
        "TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_SECRET".to_string(),
        client_secret.to_string(),
    );
    
    // Serialize to textproto using the same approach as TrailBase
    const PREFACE: &str = "# Auto-generated config.Vault textproto";
    
    let text: String = vault
        .transcode_to_dynamic()
        .to_text_format_with_options(&FORMAT_OPTIONS);
    
    Ok(format!("{PREFACE}\n{text}"))
}
