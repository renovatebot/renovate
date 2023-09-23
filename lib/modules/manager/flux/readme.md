This manager parses [Flux](https://fluxcd.io/) YAML manifests and supports:

1. [`HelmRelease`](https://fluxcd.io/docs/components/helm/helmreleases/) resources
1. ['GitRepository'](https://fluxcd.io/flux/components/source/gitrepositories/) resources
1. ['OCIRepository'](https://fluxcd.io/flux/components/source/ocirepositories/) resources
1. Flux [system](https://fluxcd.io/docs/installation) manifests

### HelmRelease support

Extracts `helm` dependencies from `HelmRelease` resources.

The `flux` manager extracts `helm` dependencies for `HelmRelease` resources linked to `HelmRepository` or `GitRepository` sources.
Renovate does support OCI `HelmRepository` sources, those with `type: oci`.

In addition, for the `flux` manager to properly link `HelmRelease` and `HelmRepository` resources, _both_ of the following conditions must be met:

1. The `HelmRelease` resource must either have its `metadata.namespace` property set or its `spec.chart.spec.sourceRef.namespace` property set
2. The referenced `HelmRepository` resource must have its `metadata.namespace` property set

Namespaces will not be inferred from the context (e.g. from the parent `Kustomization`).

Renovate updates `HelmRelease` resources coming from `GitRepository` by updating the `GitRepository` resource.

### GitRepository support

Renovate can update `git` references from `GitRepository` resources.

The `flux` manager only updates `GitRepository` fields that have a `tag` or `commit` key.

### OCIRepository support

Renovate can update `oci` references from `OCIRepository` resources.

The `flux` manager only updates `OCIRepository` fields that have a `digest` or `tag` key.
If `tag` _and_ `digest` exist then `digest` takes precedence.

### Flux system manifests support

Support updating Flux system manifests generated during [Flux installation](https://fluxcd.io/docs/installation/#customize-flux-manifests).

Updating system manifests requires that either:

1. The `flux` tool is pre-installed, or
1. You run a Docker image based on [containerbase](https://github.com/containerbase), such as the official Renovate images, and have `binarySource=install` configured

### Non-configured fileMatch

By default, the `flux` manager will only match `flux-system/{.,**}/gotk-components.yaml` (i.e. system manifest) files.

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

### Versioning

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
