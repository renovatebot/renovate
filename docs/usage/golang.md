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
1. If the user has enabled the option `gomodTidy` or `gomodTidy1.17` in the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) array, then Renovate runs `go mod tidy` or `go mod tidy -compat=1.17` respectively, which itself can update `go.mod` and `go.sum`.
   1. `gomodTidy` is implicitly enabled for major updates if the user has enabled the option `gomodUpdateImportPaths` in the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) array. If go modules 1.17 compatibility is needed you need to explicitly set the option `gomodTidy1.17`.
1. `go mod vendor` is run if vendored modules are detected
1. A PR will be created with `go.mod`,`go.sum`, and any updated vendored files updated in the one commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling Go Modules Updating

Renovate updates Go Modules by default.
To install Renovate Bot itself, either enable the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Technical Details

### Replace massaging

Renovate's default behavior is to massage any `replace` statements it finds prior to running `go` commands, and then massage them back afterwards.
This was originally done because relative `replace` statements outside of the current repo will not work when Renovate clones the repo locally.

On the other hand, this massaging of `replace` statements may lead to unexpected results, especially because `go mod tidy` may not fully tidy the `go.sum` if it is missing the `replace` directives in `go.mod`.

To disable this default behavior, and retain all `replace` statements when running `go` commands, add `gomodNoMassage` to your `postUpdateOptions` array.

### Module Tidying

Go Modules tidying is not enabled by default, and is opt-in via the [`postUpdateOptions`](https://docs.renovatebot.com/configuration-options/#postupdateoptions) config option.
The reason for this is that a `go mod tidy` command may make changes to `go.mod` and `go.sum` that are completely unrelated to the updated module(s) in the PR, and so may be confusing to some users.

### Module Vendoring

Vendoring of Go Modules is done automatically if `vendor/modules.txt` is present.
Renovate will commit all files changed within the `vendor/` folder.

### Go binary version

By default, Renovate will keep up with the latest version of the `go` binary.

You can force Renovate to use a specific version of Go by setting a constraint.
As an example, say you want Renovate to use the latest patch version of the `1.16` Go binary, you'd put this in your Renovate config:

```json
{
  "constraints": {
    "go": "1.16"
  }
}
```

We do not support patch level versions for the minimum `go` version.
This means you cannot use `go 1.16.6`, but you can use `go 1.16` as a constraint.

### Custom registry support, and authentication

This example shows how you can use a `hostRules` configuration to configure Renovate for use with a custom private Go module source using Git to pull the modules when updating `go.sum` and vendored modules.
All token `hostRules` with a `hostType` (e.g. `github`, `gitlab`, `bitbucket`, ... ) and host rules without a `hostType` are setup for authentication.

```js
module.exports = {
  hostRules: [
    {
      matchHost: 'github.enterprise.com',
      token: process.env.GO_GITHUB_TOKEN,
      hostType: 'github',
    },
    {
      matchHost: 'someGitHost.enterprise.com',
      token: process.env.GO_GIT_TOKEN,
    },
  ],
};
```
