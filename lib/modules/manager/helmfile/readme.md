Checks `helmfile.yaml` files and extracts dependencies for the `helm` datasource.

The `helmfile` manager defines this default registryAlias:

```json
{
  "registryAliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

If your Helm charts make use of repository aliases then you will need to configure an `registryAliases` object in your config to tell Renovate where to look for them. Be aware that alias values must be properly formatted URIs.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Private repositories and registries

To use private sources of Helm charts, you must set the password and username you use to authenticate to the private source.
For this you use a custom `hostRules` array.

#### OCI registries

```json5
{
  hostRules: [
    {
      // global login
      matchHost: 'ghcr.io',
      hostType: 'docker',
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // login with encrypted password
      matchHost: 'https://ghci.io',
      hostType: 'docker',
      username: '<some-username>',
      encrypted: {
        password: 'some-encrypted-password',
      },
    },
  ],
}
```
