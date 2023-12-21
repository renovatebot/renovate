Can upgrade bundle definitions and GitRepo YAML manifests of Rancher Fleet.

By default, only bundles with Helm references will be upgraded.
To enable GitRepo updates you have to extend your [`fileMatch`](../../../configuration-options.md#filematch) configuration.

```json
{
  "fileMatch": ["'(^|/)fleet.ya?ml", "myGitRepoManifests\\.yaml"]
}
```
