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

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
