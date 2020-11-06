---
title: Go Modules
description: Go modules support in Renovate
---

# Automated Dependency Updates for Go Modules

Renovate supports upgrading dependencies in `go.mod` files and their accompanying `go.sum` checksums.

## How It Works

1.  Renovate will search each repository for any `go.mod` files
2.  Existing dependencies will be extracted from `require` statements
3.  Renovate will resolve the dependency's source repository and check for semver tags if found. Otherwise commits and `v0.0.0-....` syntax will be used
4.  If an update was found, Renovate will update `go.mod` to the new value
5.  Renovate will run `go get` to update the `go.sum` files
6.  If the user has enabled the option `gomodTidy` in the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) array, then Renovate will run `go mod tidy`, which itself can update `go.mod` and `go.sum`
7.  `go mod vendor` will be run if vendored modules have been detected
8.  A PR will be created with `go.mod`,`go.sum`, and any updated vendored files updated in the one commit
9.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling Go Modules Updating

Go Modules updating is on by default in Renovate Bot.
To install Renovate Bot itself, either enable the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Technical Details

#### Module Tidying

Go Modules tidying is not enabled by default, and so is opt-in via the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) config option.
The reason for this is that a `go mod tidy` command may make changes to `go.mod` and `go.sum` that are completely unrelated to the updated module(s) in the PR, and so may be confusing to some users.

#### Module Vendoring

Vendoring of Go Modules is done automatically if `vendor/modules.txt` is present.
Renovate will commit all files changed within the `vendor/` folder.

#### Go binary version

Currently, Renovate will try to keep up with the very latest version of `go`, and it is not configurable.
It is planned though to support a configurable version of `go` per-repository soon.
