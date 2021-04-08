---
title: Go Modules
description: Go modules support in Renovate
---

# Automated Dependency Updates for Go Modules

Renovate supports upgrading dependencies in `go.mod` files and their accompanying `go.sum` checksums.

## How It Works

1. Renovate searches in each repository for any `go.mod` files
1. Renovate extracts existing dependencies from `require` statements
1. Renovate resolves the dependency's source repository and checks for SemVer tags if found. Otherwise commits and `v0.0.0-....` syntax will be used
1. If Renovate finds an update, Renovate will update `go.mod` to the new value
1. Renovate runs `go get` to update the `go.sum` files
1. If the user has enabled the option `gomodUpdateImportPaths` in the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) array, then Renovate uses [mod](https://github.com/marwan-at-work/mod) to update import paths on major updates, which can update any Go source file
1. If the user has enabled the option `gomodTidy` in the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) array, then Renovate runs `go mod tidy`, which itself can update `go.mod` and `go.sum`.
   1. This is implicitly enabled for major updates
1. `go mod vendor` is run if vendored modules are detected
1. A PR will be created with `go.mod`,`go.sum`, and any updated vendored files updated in the one commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling Go Modules Updating

Renovate updates Go Modules by default.
To install Renovate Bot itself, either enable the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Technical Details

### Module Tidying

Go Modules tidying is not enabled by default, and is opt-in via the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) config option.
The reason for this is that a `go mod tidy` command may make changes to `go.mod` and `go.sum` that are completely unrelated to the updated module(s) in the PR, and so may be confusing to some users.

### Module Vendoring

Vendoring of Go Modules is done automatically if `vendor/modules.txt` is present.
Renovate will commit all files changed within the `vendor/` folder.

### Go binary version

By default, Renovate will keep up with the very latest version of `go`.

You can "pin" the `go` version that Renovate uses.
Say you want Renovate to use Go version 1.14, you can do this by adding `go 1.14` to your `go.mod` file.
We do not support pinning Go versions to a specific patch level, so you cannot use `go 1.14.12`, but you can use `go 1.14` in your `go.mod` file.
