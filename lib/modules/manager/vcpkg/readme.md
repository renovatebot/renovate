Extracts the `dependencies` and `overrides` of [vcpkg](https://learn.microsoft.com/vcpkg/) `vcpkg.json` manifests, looked up with the [`vcpkg`](../../datasource/vcpkg/index.md) datasource and [`vcpkg`](../../versioning/vcpkg/index.md) versioning.

A dependency's current value is its `version>=` lower bound, with a non-zero port version as `#N`, as in `1.3.2#2`.
A dependency without `version>=`, including a bare port name, gets `skipReason` `unspecified-version`.

An override's current value is its `version`, `version-semver`, `version-date` or `version-string`, with a non-zero `port-version` appended as `#N`.
An update writes the new upstream version to that field and the new port version to `port-version`, which it removes when the new value has none.

vcpkg applies `version>=` and overrides only when the manifest has a baseline, such as `builtin-baseline`, and finds a new version only in a vcpkg checkout or registry that lists it.
