Renovate supports updating Helm Chart references within `requirements.yaml` files.

The `helm-requirements` manager defines this default registryAlias:

```json
{
  "registryAliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

If your Helm charts make use of repository aliases then you will need to configure an `registryAliases` object in your config to tell Renovate where to look for them. Be aware that alias values must be properly formatted URIs.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

To learn how to use Helm with private packages, read [private package support, Package Manager Credentials for Artifact Updating, helm](../../../getting-started/private-packages.md#helm).
