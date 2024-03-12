---
title: Go Modules
description: Go modules support in Renovate
---

# Automated Dependency Updates for Go Modules

Renovate supports upgrading dependencies in `go.mod` files and associated `go.sum` checksums.

If you're self-hosting Renovate, you may use these environment variables:

- `GOPROXY`
- `GONOPROXY`
- `GOPRIVATE`
- `GOINSECURE`

To learn what these variables do, read the [Go Modules Reference about the`GOPROXY` protocol](https://go.dev/ref/mod#module-proxy).

## How It Works

1. Renovate searches in each repository for any `go.mod` files
1. Renovate extracts existing dependencies from `require` statements
1. Renovate resolves the dependency's source repository and checks for SemVer tags if found. Otherwise commits and `v0.0.0-....` syntax will be used
1. If Renovate finds an update, Renovate will update `go.mod` to the new value
1. Renovate runs `go get` to update the `go.sum` files (you can configure which directory are included using the `goGetDirs` option)
1. If the user has enabled the option `gomodUpdateImportPaths` in the [`postUpdateOptions`](./configuration-options.md#postupdateoptions) array, then Renovate uses [mod](https://github.com/marwan-at-work/mod) to update import paths on major updates, which can update any Go source file
1. If the user has any of the available `gomodTidy` options (e.g. `gomodTidy1.17`) in the [`postUpdateOptions`](./configuration-options.md#postupdateoptions), then Renovate runs `go mod tidy` with the respective options (multiple options are allowed).
1. `go mod vendor` is run if vendored modules are detected
1. A PR will be created with `go.mod`,`go.sum`, and any updated vendored files updated in the one commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling Go Modules Updating

Renovate updates Go Modules by default.
To install Renovate Bot itself, either enable the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.

## Technical Details

### Replace massaging

Renovate can massage `replace` statements it finds prior to running `go` commands, and then massage them back afterwards.
This capability was added - and originally default behavior - because relative `replace` statements outside of the current repo will not work when Renovate clones the repo locally.

On the other hand, this massaging of `replace` statements may lead to unexpected results, especially because `go mod tidy` may not fully tidy the `go.sum` if it is missing the `replace` directives in `go.mod`.
It has therefore been disabled by default.

To enable this replace massaging behavior, add `gomodMassage` to your `postUpdateOptions` array.

### Module Tidying

Go Modules tidying is not enabled by default, and is opt-in via the [`postUpdateOptions`](./configuration-options.md#postupdateoptions) config option.
The reason for this is that a `go mod tidy` command may make changes to `go.mod` and `go.sum` that are completely unrelated to the updated module(s) in the PR, and so may be confusing to some users.

### Module Vendoring

Vendoring of Go Modules is done automatically if `vendor/modules.txt` is present.
Renovate will commit all files changed within the `vendor/` folder.

<!-- prettier-ignore -->
!!! note
    Renovate does not support vendoring major upgrades of Go modules.
    Follow issue [#21010](https://github.com/renovatebot/renovate/issues/21010).

### Go binary version

By default, Renovate will keep up with the latest version of the `go` binary.

You can force Renovate to use a specific version of Go by setting a constraint.

```json title="Getting Renovate to use the latest patch version of the 1.16 Go binary"
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
