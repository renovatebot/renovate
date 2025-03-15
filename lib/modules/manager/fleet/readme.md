Can upgrade bundle definitions and GitRepo YAML manifests of Rancher Fleet.

By default, only bundles with Helm references will be upgraded.
To enable GitRepo updates you have to extend your [`filePatterns`](../../../configuration-options.md#filepatterns) configuration.

```json
{
  "filePatterns": ["/(^|/)fleet.ya?ml/", "/myGitRepoManifests\\.yaml/"]
}
```
