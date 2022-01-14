Checks YAML manifests for [Flux](https://fluxcd.io/) `HelmRelease` resources and extracts dependencies for the `helm` datasource.

Note that the `flux` manager will only extract `HelmRelease` resources linked to `HelmRepository` sources. `HelmRelease` resources linked to other kinds of sources like `GitRepository` or `Bucket` will be ignored.

Also, for the `flux` manager to properly link `HelmRelease` and `HelmRepository` resources, both must have their `namespace` explicitly set in their `metadata`. Dependencies will not be extracted from resources where `metadata.namespace` is omitted. (However, the namespace can be omitted from the `HelmRelease` resource's `spec.chart.spec.sourceRef` property.)

The `flux` manager has no `fileMatch` default patterns, so it won't match any files until you configure it with a pattern. This is because there is no commonly accepted file/directory naming convention for Flux manifests and we don't want to check every single `*.yaml` file in repositories just in case any of them contain Flux definitions.

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
