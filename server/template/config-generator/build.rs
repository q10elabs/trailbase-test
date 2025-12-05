fn main() -> std::io::Result<()> {
    println!("cargo::rerun-if-changed=proto");
    
    let config = prost_build::Config::new();
    
    // Use prost-reflect-build to compile proto and generate descriptor pool
    // This generates the Rust code and file descriptor set
    // prost-reflect-build automatically adds ReflectMessage derive
    prost_reflect_build::Builder::new()
        .descriptor_pool("crate::DESCRIPTOR_POOL")
        .compile_protos_with_config(
            config,
            &["proto/vault.proto"],
            &["proto"],
        )?;
    
    Ok(())
}
