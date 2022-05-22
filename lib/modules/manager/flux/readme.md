This manager parses [Flux](https://fluxcd.io/) YAML manifests and:

1. Extracts `helm` dependencies from `HelmRelease` resources
2. Extracts `github-releases` dependencies from system manifests (`flux-system/gotk-components.yaml` files) and regenerates them when new versions of Flux are available

The `flux` manager will only extract `helm` dependencies for `HelmRelease` resources linked to `HelmRepository` sources.
`HelmRelease` resources linked to other kinds of sources like `GitRepository` or `Bucket` will be ignored.

For the `flux` manager to properly link `HelmRelease` and `HelmRepository` resources, _both_ of the following conditions must be met:

1. The `HelmRelease` resource must either have its `metadata.namespace` property set or its `spec.chart.spec.sourceRef.namespace` property set
2. The referenced `HelmRepository` resource must have its `metadata.namespace` property set

Namespaces will not be inferred from the context (e.g. from the parent `Kustomization`).

Updating system manifests requires that either:

1. The `flux` tool is pre-installed, or
2. You run a Docker image based on [containerbase/buildpack](https://github.com/containerbase/buildpack), such as the official Renovate images, and have `binarySource=install` configured

By default, the `flux` manager will only match `flux-system/gotk-components.yaml` (i.e. system manifest) files.
This is because there is no commonly accepted file/directory naming convention for Flux manifests and we don't want to check every single `*.yaml` file in repositories just in case some of them have Flux definitions.

If most `.yaml` files in your repository are Flux manifests, then you could add this to your config:

```json
{
  "flux": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

If instead you have all your Flux manifests inside a `flux/` directory, you would add this:

```json
{
  "flux": {
    "fileMatch": ["flux/.+\\.yaml$"]
  }
}
```

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
