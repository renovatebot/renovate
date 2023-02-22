---
title: Rust crates
description: Rust crates support in Renovate
---

# Automated Dependency Updates for Rust crates

Renovate supports upgrading dependencies in `Cargo.toml` files and their accompanying `Cargo.lock` checksums.

## How it works

1. Renovate searches in each repository for any `Cargo.toml` files
1. Renovate extracts existing dependencies from `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` and `[workspace.dependencies]`
1. Renovate looks up Cargo configuration to find index URLs for private registries
1. Renovate resolves the dependency's version using the crates.io API or by cloning the index URL
1. If Renovate finds an update, Renovate will use `cargo update` to update both `Cargo.toml` and `Cargo.lock`

## Enabling Rust Modules Updating

Renovate updates Rust crates by default.

## Cargo configuration and private registry discovery

Renovate can find private registry URLs in these Cargo configuration files:

- `.cargo/config.toml`
- `.cargo/config` (legacy)

Renovate can also find private registry URLs via a `CARGO_REGISTRIES_<name>_INDEX` environment variable.
Read the [Rust environment variables docs](https://doc.rust-lang.org/cargo/reference/environment-variables.html#configuration-environment-variables) to learn more.

## Private crate registries and private Git dependencies

If any dependencies are hosted in private Git repositories, [Git Authentication for cargo](https://doc.rust-lang.org/cargo/appendix/git-authentication.html) must be set up.

If any dependencies are hosted on private crate registries (i.e., not on `crates.io`), then credentials should be set up in such a way that the Git command-line is able to clone the registry index.
Third-party crate registries usually provide instructions to achieve this.

Both of these are currently only possible when running Renovate self-hosted.
