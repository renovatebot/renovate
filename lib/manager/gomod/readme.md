You might be interested in the following `postUpdateOptions`:

1. `gomodTidy` - if you'd like Renovate to run `go mod tidy` after every update before raising the PR.
   1. This is implicitly enabled for major updates
1. `gomodUpdateImportPaths` - if you'd like Renovate to update your source import paths on major updates before raising the PR.
