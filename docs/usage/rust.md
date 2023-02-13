---
title: Rust crates
description: Rust crates support in Renovate
---

# Automated Dependency Updates for Rust crates

Renovate supports upgrading dependencies in `Cargo.toml` files and their accompanying `Cargo.lock` checksums.

## How it works

1. Renovate searches in each repository for any `Cargo.toml` files
1. Renovate extracts existing dependencies from `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` and `[workspace.dependencies]`
1. Renovate tries to find and parse a `.cargo/config.toml` file to discover index URLs for private registries
1. Renovate resolves the dependency's version using the crates.io API or by cloning the index URL
1. If Renovate finds an update, Renovate will use `cargo update` to update both `Cargo.toml` and `Cargo.lock`

## Enabling Rust Modules Updating

Renovate updates Rust crates by default.

## Private Git crate registries and private Git dependencies

If any dependencies are hosted in private Git repositories, [Git Authentication for cargo](https://doc.rust-lang.org/cargo/appendix/git-authentication.html) must be set up.

If any dependencies are hosted on private Git crate registries (i.e., not on `crates.io`), then credentials should be set up in such a way that the Git command-line is able to clone the registry index.
Third-party crate registries usually provide instructions to achieve this.

Both of these are currently only possible when running Renovate self-hosted.

## Private sparse crate registries

Renovate can update dependencies hosted on a private sparse crate registry (<https://doc.rust-lang.org/beta/cargo/reference/registry-index.html#sparse-protocol>).
Since sparse registries are HTTP based, authentication for Renovate can be configured via additional hostRules.

Renovate can only update Cargo lockfiles for projects using dependencies from sparse registries if the local Rust toolchain has the sparse-registry feature enabled (i.e beta/nightly/or 1.68 or later - 1.68 is due for release on March 9th 2023).
