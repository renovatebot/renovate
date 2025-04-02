### Updating of Go mod and toolchain directives

In `go.mod`, the `go` directive essentially means "Compatible with this version or later".
It is generally recommended for Go projects to _not_ bump this version unless necessary, and therefore Renovate's default behavior is not to propose upgrades to it.
However, a dependency may still enforce a version bump when it's `go` directive is newer. That can be controlled using a constraint (see below).
If you need to update it once or irregularly, it's recommended to do it manually.
If you are sure you want to always bump it to latest, then you need the following configuration:

```json
{
  "packageRules": [
    {
      "matchManagers": ["gomod"],
      "matchDepNames": ["go"],
      "matchDepTypes": ["golang"],
      "rangeStrategy": "bump"
    }
  ]
}
```

Even without automated `go` version bumping by renovate, a dependency may still cause a bump. Since go1.21 the `go` directive is then automatically updated.
To limit that to an acceptable version range, you need to define a constraint.
For example, if the module shall stay on the go1.22 release, the `go` directive would be `go 1.22.0` and the constraint:

```json
{
  "constraints": {
    "go": "1.22"
  }
}
```

If the constrained version is greater then that specified by the current `go` directive, renovate will bump the directive!

In `go.mod`, the `toolchain` directive essentially means "Use this exact version of go" for module management and compilation.
Unlike the `go` directive, it is valid to keep bumping this, and you should see updates to it proposed by default, unless the directive is not present.

### Post-Update Options

You might be interested in the following `postUpdateOptions`:

<!--
  TODO: remove ignore
  prettier & markdownlint conflicting nested list format
  see: https://github.com/renovatebot/renovate/pull/30608
-->
<!-- prettier-ignore -->
1. `gomodTidy` - if you'd like Renovate to run `go mod tidy` after every update before raising the PR
    1. This is implicitly enabled for major updates if the user has enabled the option `gomodUpdateImportPaths`
1. `gomodTidy1.17` - if you'd like Renovate to run `go mod tidy -compat=1.17` after every update before raising the PR
1. `gomodTidyE` - if you'd like Renovate to run `go mod tidy -e` after every update before raising the PR
1. `gomodUpdateImportPaths` - if you'd like Renovate to update your source import paths on major updates before raising the PR
1. `gomodMassage` - to enable massaging of all `replace` statements prior to running `go` so that they will be ignored

When Renovate is running using `binarySource=docker` (such as in the Mend Renovate App) then it will pick the latest compatible version of Go to run, i.e. the latest `1.x` release.
Even if the `go.mod` has a version like `go 1.22`, Renovate will treat it as a `^1.22` constraint and not `=1.22`.

Indirect updates are disabled by default. To enable them, add a package rule such as:

```json
{
  "packageRules": [
    {
      "matchManagers": ["gomod"],
      "matchDepTypes": ["indirect"],
      "enabled": true
    }
  ]
}
```

### Private Modules Authentication

Before running the `go` commands to update the `go.sum`, Renovate exports `git` [`insteadOf`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlltbasegtinsteadOf) directives in environment variables.

The following logic is executed prior to "artifacts" updating:

The token from the `hostRules` entry matching `hostType=github` and `matchHost=api.github.com` is added as the default authentication for `github.com`.
For those running against `github.com`, this token will be the default platform token.

Next, all `hostRules` with both a token or username/password and `matchHost` will be fetched, except for any github.com one from above.

Rules from this list are converted to environment variable directives if they match _any_ of the following characteristics:

- No `hostType` is defined, or
- `hostType` is `go`, or
- `hostType` is a platform (`github`, `gitlab`, `azure`, etc.)

### Major upgrades of dependencies

Major upgrades in Go are different from most other ecosystems, because both the version and module name need to be changed.
It is very common that such upgrades require changes to application code, which Renovate doesn't do.

By default, Renovate will make such change in the `go.mod` files but nothing else - the rest is up to you.
If you add `gomodUpdateImportPaths` to `postUpdateOptions` then Renovate will also use a third-party tool to migrate import paths within application code, but there may still be actual application logic which needs to be changed too.

Ultimately: it is known and unavoidable that the majority of major Go upgrades won't be immediately mergeable.
You might prefer to configure such major updates with `dependencyDashboardApproval=true` so that you can request them on demand, on supported platforms.
