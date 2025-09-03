Can upgrade bundle definitions and GitRepo YAML manifests of Rancher Fleet.

By default, only bundles with Helm references will be upgraded.
To enable GitRepo updates you have to extend your [`managerFilePatterns`](../../../configuration-options.md#managerfilepatterns) configuration.

```json
{
  "managerFilePatterns": ["/(^|/)fleet.ya?ml/", "/myGitRepoManifests\\.yaml/"]
}
```
