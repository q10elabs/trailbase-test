//! Config generator for TrailBase server configuration
//!
//! Reads a template config file and an authn file, then generates a customized
//! config.textproto file with OAuth credentials filled in.

use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() != 4 {
        eprintln!("Usage: {} <template-file> <authn-file> <output-file>", args[0]);
        eprintln!("  template-file: Path to config.textproto.template");
        eprintln!("  authn-file: Path to .authn file with OAuth credentials");
        eprintln!("  output-file: Path to write the generated config.textproto");
        process::exit(1);
    }
    
    let template_path = &args[1];
    let authn_path = &args[2];
    let output_path = &args[3];
    
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
    
    // Replace placeholders in template
    let config = template
        .replace("{{GOOGLE_OAUTH_CLIENT_ID}}", &client_id)
        .replace("{{GOOGLE_OAUTH_CLIENT_SECRET}}", &client_secret);
    
    // Write output file
    match fs::write(output_path, config) {
        Ok(_) => {
            eprintln!("Successfully generated config file: {}", output_path);
        }
        Err(e) => {
            eprintln!("Error writing output file '{}': {}", output_path, e);
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
