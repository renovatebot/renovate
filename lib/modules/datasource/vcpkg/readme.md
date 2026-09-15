This datasource returns versions of [vcpkg](https://learn.microsoft.com/vcpkg/concepts/registries) ports.

A vcpkg registry is a Git repository with a known on-disk layout.
For a port named `<port>` the version history lives in `versions/<first-letter>-/<port>.json`, where `<first-letter>` is the first character of the port name in lowercase.
Ports whose names start with a digit live under `versions/0-/`.

The datasource clones the registry repository to a local cache directory and reads the per-port file from disk.
The cache directory is derived from the registry URL, so each registry is cloned at most once per run.

Custom registries are supported as first-class registries.
Set `registryUrls` to the Git URL of any vcpkg registry.
The default `registryUrl` is `https://github.com/microsoft/vcpkg`, the canonical vcpkg registry.

Each release entry uses the upstream version string, with a `#N` suffix appended when the port revision (`port-version`) is greater than zero.
The Git tree object id is exposed as `newDigest` so that lockfiles can pin to an exact tree.
