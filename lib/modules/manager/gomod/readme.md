You might be interested in the following `postUpdateOptions`:

1. `gomodTidy` - if you'd like Renovate to run `go mod tidy` after every update before raising the PR.
   1. This is implicitly enabled for major updates if the user has enabled the option `gomodUpdateImportPaths`
1. `gomodTidy1.17` - if you'd like Renovate to run `go mod tidy -compat=1.17` after every update before raising the PR.
1. `gomodUpdateImportPaths` - if you'd like Renovate to update your source import paths on major updates before raising the PR.

When Renovate is running using `binarySource=docker` (such as in the hosted WhiteSource Renovate app) then it will pick the latest compatible version of Go to run, i.e. the latest `1.x` release.
Therefore even if the `go.mod` has a version like `go 1.14`, you will see Renovate treating that as a `^1.14` constraint and not `=1.14`.
