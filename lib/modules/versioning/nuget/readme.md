NuGet versioning matches as closely as possible to the version comparison that NuGet itself uses.

Updates preserve whole-component wildcards. With `rangeStrategy: "bump"`, an update from `17.*` targeting `18.11.0` produces `18.*`, not `18.1*`.
A target of `17.14.1` leaves `17.*` unchanged and does not require a package-file update.

Wildcard preservation applies whenever a floating range is generated, not only with `rangeStrategy: "bump"`.
For example, `rangeStrategy: "update-lockfile"` can update a locked version from `17.0.0` to `17.14.1` without changing `17.*` in the package file.
With `rangeStrategy: "in-range-only"`, preserving the range allows this lockfile update instead of discarding it as a package-file change.

This does not change NuGet's range-satisfaction semantics or prerelease filtering.
