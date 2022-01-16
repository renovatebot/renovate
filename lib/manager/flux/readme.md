Checks YAML manifests for [Flux](https://fluxcd.io/) `HelmRelease` resources and extracts dependencies for the `helm` datasource.

The `flux` manager will only extract `HelmRelease` resources linked to `HelmRepository` sources.
`HelmRelease` resources linked to other kinds of sources like `GitRepository` or `Bucket` will be ignored.

For the `flux` manager to properly link `HelmRelease` and `HelmRepository` resources, _both_ of the following conditions must be met:

1. The `HelmRelease` resource must either have its `metadata.namespace` property set or its `spec.chart.spec.sourceRef.namespace` property set.
2. The referenced `HelmRepository` resource must have its `metadata.namespace` property set.

Namespaces will not be inferred from the context (e.g. from the parent `Kustomization`).

The `flux` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern.
This is because there is no commonly accepted file/directory naming convention for Flux manifests and we don't want to check every single `*.yaml` file in repositories just in case some of them contain Flux definitions.

If most `.yaml` files in your repository are Flux manifests, then you could add this to your config:

```json
{
  "flux": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have them all inside a `flux/` directory, you would add this:

```json
{
  "flux": {
    "fileMatch": ["flux/.+\\.yaml$"]
  }
}
```

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
