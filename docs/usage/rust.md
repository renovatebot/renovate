---
title: Rust crates
description: Rust crates support in Renovate
---

# Automated Dependency Updates for Rust crates

Renovate supports upgrading dependencies in `Cargo.toml` files and associated `Cargo.lock` checksums.

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

You as user can set authentication for private crates by adding a `hostRules` configuration to your `renovate.json` file.

All token `hostRules` with a `hostType` (e.g. `github`, `gitlab`, `bitbucket`, etc.) and host rules without a `hostType` will be automatically setup for authentication.
You can also configure a `hostRules` that's only for Cargo authentication (e.g. `hostType: 'cargo'`).

```js title="Example of authentication for a private GitHub and Cargo registry:"
module.exports = {
  hostRules: [
    {
      matchHost: 'github.enterprise.com',
      token: process.env.GITHUB_TOKEN,
      hostType: 'github',
    },
    {
      matchHost: 'someGitHost.enterprise.com',
      token: process.env.CARGO_GIT_TOKEN,
      hostType: 'cargo',
    },
  ],
};
```
