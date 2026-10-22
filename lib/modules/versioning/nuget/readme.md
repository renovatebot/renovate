NuGet versioning matches as closely as possible to the version comparison that NuGet itself uses.

Updates preserve whole-component wildcards. With `rangeStrategy: "bump"`, an update from `17.*` targeting `18.11.0` produces `18.*`, not `18.1*`.
A target of `17.14.1` leaves `17.*` unchanged and does not require a package-file update.

This does not change NuGet's range-satisfaction semantics or prerelease filtering.
