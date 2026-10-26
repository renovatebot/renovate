Extracts the `dependencies` and `overrides` of [vcpkg](https://learn.microsoft.com/vcpkg/) `vcpkg.json` manifests, looked up with the [`vcpkg`](../../datasource/vcpkg/readme.md) datasource and [`vcpkg`](../../versioning/vcpkg/readme.md) versioning.

A dependency's current value is its `version>=` lower bound.
A dependency without `version>=`, including a bare port name, gets `skipReason` `unspecified-version`.

An override's current value is its `version`, `version-semver`, `version-date` or `version-string`, with a non-zero `port-version` appended as `#N`.
