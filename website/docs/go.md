---
title: Go Modules
description: Go modules support in Renovate
---

# Dependency Update Automation for Go Modules

Renovate supports upgrading dependencies in `go.mod` files and their accompanying `go.sum` checksums.

## How It Works

1.  Renovate will search each repository for any `go.mod` files.
2.  Existing dependencies will be extracted from `require` statements
3.  Renovate will resolve the dependency's source repository and check for semver tags if found (GitHub-only currently)
4.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Limitations / Future work

- [#2580](https://github.com/renovatebot/renovate/issues/2580) Support vendoring of dependencies (i.e. Renoate updating the `vendor/` directory in same PR)

- [#2583](https://github.com/renovatebot/renovate/issues/2583) Support major version updates >1 (requires changing the dependency "name" in both `go.mod` as well as source files that reference it)

- [#2586](https://github.com/renovatebot/renovate/issues/2586) Updating commit hashes in `go.mod` files for dependencies that don't yet support tagged versions
