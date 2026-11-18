This datasource returns versions of [vcpkg](https://learn.microsoft.com/vcpkg/concepts/registries) ports.

A vcpkg registry is a Git repository with a known on-disk layout.
For a port named `<port>` the version history lives in `versions/<first-letter>-/<port>.json`, where `<first-letter>` is the first character of the port name in lowercase.

The default `registryUrl` is `https://github.com/microsoft/vcpkg`, the curated vcpkg registry.
The datasource fetches its per-port files over HTTP, without a clone.

Set `registryUrls` to the Git URL of any other vcpkg registry.
The datasource clones such a registry, with its full history, to a local cache directory, once per run, and reads the per-port file from disk.
The Renovate admin must allow this with [`allowCustomVcpkgRegistries`](../../../self-hosted-configuration.md#allowcustomvcpkgregistries).
For a private registry over HTTPS, add its credentials as a host rule with `hostType` `vcpkg` and the registry's URL.

Only Git registries are supported, not filesystem registries.

Each release entry uses the upstream version string, with a `#N` suffix appended when the port revision (`port-version`) is greater than zero.

A release's timestamp is the commit time of the commit that added the version to the port's versions file.
For the default registry, the datasource reads it with the GitHub GraphQL API, which needs a github.com token; without one, the releases have no timestamps.
For another registry, it reads it from the clone.
Versions added before the registry had versions files, such as those in the default registry before 2021, have the date of the commit that created the file.
