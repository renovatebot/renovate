Renovate supports updating Helm Chart references in:

- `requirements.yaml` files, for Helm v2
- `Chart.yaml` files, for Helm v3

The `helmv3` manager defines this default registryAlias:

```json
{
  "registryAliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

If you use repository aliases in your Helm charts then you must set an `registryAliases` object in your configuration file so Renovate knows where to find the repository.
Alias values must be properly formatted URIs.

If you need to change the versioning format, read our [versioning](../../versioning/index.md) documentation to learn more.

### Private repositories and registries

To use private sources in your Helm charts, you must set the `password` and `username` you use to authenticate to the private source.
For this you use a custom `hostRules` array.

#### OCI registries

```json5
{
  hostRules: [
    {
      // Global login
      matchHost: 'registry.gitlab.com',
      hostType: 'docker',
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // For repository string oci://registry.gitlab.com/user/oci-helm-test
      matchHost: 'https://registry.gitlab.com/user/oci-helm-test',
      hostType: 'docker',
      username: '<some-username>',
      password: '<some-password>',
    },
  ],
}
```

#### Helm repository

```json5
{
  hostRules: [
    {
      // Global login for 'gitlab.com' if using Helm
      matchHost: 'gitlab.com',
      hostType: 'helm', // this is optional, but else the credentials will be used for all requests matching `matchHost`
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // Specific repository
      matchHost: 'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
      hostType: 'helm', // this is optional
      username: '<some-username>',
      password: '<some-password>',
    },
  ],
}
```

### Subchart archives

To get updates for subchart archives put `helmUpdateSubChartArchives` in your `postUpdateOptions` configuration.
Renovate now updates archives in the `/charts` folder.

```json
{
  "postUpdateOptions": ["helmUpdateSubChartArchives"]
}
```
