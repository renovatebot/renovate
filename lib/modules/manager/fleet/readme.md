Can upgrade bundle definitions and GitRepo YAML manifests of Rancher Fleet.

By default, only bundles with Helm references will be upgraded.
To enable GitRepo updates you have to extend your [`managerFilePatterns`](../../../configuration-options.md#managerfilepatterns) configuration.

```json
{
  "fleet": {
    "managerFilePatterns": ["/(^|/)fleet.ya?ml/", "/myGitRepoManifests\\.yaml/"]
  }
}
```

Helm charts stored in OCI registries are supported in both forms Fleet accepts: `helm.repo: oci://...` (recommended by Fleet) and the deprecated `helm.chart: oci://...`.
When `helm.repo` is an OCI URL, it is the full chart reference and `helm.chart` is ignored, as Fleet does.

In case pull through cache configured via internal registry, it is possible to setup registryAlias to query package updates via upstream source

```json
{
  "registryAliases": {
    "https://registry.com/jetstack": "https://charts.jetstack.io",
    "registry.com/docker-io": "registry-1.docker.io"
  }
}
```
