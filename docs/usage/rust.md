---
title: Rust crates
description: Rust crates support in Renovate
---

# Automated Dependency Updates for Rust crates

Renovate supports upgrading dependencies in `Cargo.toml` files and their accompanying `Cargo.lock` checksums.

## How it works

1. Renovate searches in each repository for any `Cargo.toml` files
1. Renovate extracts existing dependencies from `[dependencies]`, `[dev-dependencies]` and `[build-dependencies]`
1. Renovate tries to find and parse a `.cargo/config.toml` file to discover index URLs for private registries
1. Renovate resolves the dependency's version using the crates.io API or by cloning the index URL
1. If Renovate finds an update, Renovate will use `cargo update` to update both `Cargo.toml` and `Cargo.lock`

## Enabling Rust Modules Updating

Renovate updates Rust crates by default.

## Private Git-based crate registries / private Git dependencies

If any dependencies are hosted in private Git repositories, [Git Authentication for cargo](https://doc.rust-lang.org/cargo/appendix/git-authentication.html) must be set up.

If any dependencies are hosted on private crate registries (i.e., not on `crates.io`), then credentials should be set up in such a way that the Git command-line is able to clone the registry index.
Third-party crate registries usually provide instructions to achieve this.

Both of these are currently only possible when running Renovate self-hosted.

## Private sparse index registries

If dependencies are available via a "sparse index", you may use
`registryAliases` to let Renovate accesses the dependencies via the `sparse`
protocol. If needed, set the authentication details with the `hostRules` config
option. `crates.io` index access will still be via Renovates shared clone of
the public Git index.

For instance with a username and password:

```json
"hostRules": [
    {
      "hostType": "cargo-git",
      "matchHost": "https://INSTANCE.jfrog.io",
      "username": "USERNAME",
      "password": "PASSWORD"
    },
    {
      "hostType": "cargo-http",
      "matchHost": "https://INSTANCE.jfrog.io",
      "authType": "Token-Only",
      "token": "Basic username-and-password-base64-encoded"
    }
  ]
```

With a bearer token:

```json
"hostRules": [
    {
      "hostType": "cargo-git",
      "matchHost": "https://INSTANCE.jfrog.io",
      "username": "TOKEN_NAME",
      "password": "TOKEN_VALUE"
    },
    {
      "hostType": "cargo-http",
      "matchHost": "https://INSTANCE.jfrog.io",
      "authType": "Token-Only",
      "token": "Bearer TOKEN_VALUE"
    }
  ]
```
