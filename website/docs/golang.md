---
title: Go Modules
description: Go modules support in Renovate
---

# Automated Dependency Updates for Go Modules

Renovate supports upgrading dependencies in `go.mod` files and their accompanying `go.sum` checksums.

## How It Works

1.  Renovate will search each repository for any `go.mod` files.
2.  Existing dependencies will be extracted from `require` statements
3.  Renovate will resolve the dependency's source repository and check for semver tags if found
4.  A PR will be created with `go.mod` and `go.sum` updated in the same commit
5.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) or [Renovate Pro](https://renovatebot.com/pro) for self-hosted options.

## Future work

- [#2580](https://github.com/renovatebot/renovate/issues/2580) Support vendoring of dependencies (i.e. Renovate updating the `vendor/` directory in same PR as it update `go.mod` and `go.sum`)
