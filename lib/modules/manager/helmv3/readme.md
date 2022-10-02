Renovate supports updating Helm Chart references within `requirements.yaml` (Helm v2) and `Chart.yaml` (Helm v3) files.

The `helmv3` manager defines this default registryAlias:

```json
{
  "registryAliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

If your Helm charts make use of repository aliases then you will need to configure an `registryAliases` object in your config to tell Renovate where to look for them. Be aware that alias values must be properly formatted URIs.

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.

### Private repositories and registries

To use private sources of Helm charts, you must set the password and username you use to authenticate to the private source.
For this you use a custom `hostRules` array.

#### OCI registries

```json5
{
  hostRules: [
    {
      // global login
      matchHost: 'registry.gitlab.com',
      hostType: 'docker',
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // for repository string oci://registry.gitlab.com/user/oci-helm-test
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
      // global login for 'gitlab.com' if using Helm
      matchHost: 'gitlab.com',
      hostType: 'helm', // this is optional, but else the credentials will be used for all request matching `matchHost`
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // specific repository
      matchHost: 'https://gitlab.com/api/v4/projects/xxxxxxx/packages/helm/stable',
      hostType: 'helm', // this is optional
      username: '<some-username>',
      password: '<some-password>',
    },
  ],
}
```
