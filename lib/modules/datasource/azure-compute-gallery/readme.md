This datasource returns Azure Compute Gallery image versions from the Azure Resource Manager API.

It has no built-in manager. Use a custom manager to extract the current image version and provide the lookup parameters as `packageName`.

Authentication uses `DefaultAzureCredential` from the Azure SDK. For self-hosted Renovate, use a non-interactive credential source such as service principal environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`), workload identity, or managed identity.

The Azure identity needs read access to the gallery image versions. A `Reader` assignment at the gallery, resource group, or subscription scope is sufficient.

`packageName` must be a minified JSON object with these fields:

```json
{
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "resourceGroupName": "rg-renovate",
  "galleryName": "renovateGallery",
  "galleryImageName": "ubuntu-2204"
}
```

The datasource calls:

```http
GET https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/galleries/{galleryName}/images/{galleryImageName}/versions?api-version=2025-03-03
```

Versions with `properties.publishingProfile.excludeFromLatest: true` are ignored.

To use a sovereign Azure cloud, configure a custom `registryUrl`, for example `https://management.usgovcloudapi.net`, and configure the matching Azure identity authority, for example `AZURE_AUTHORITY_HOST=https://login.microsoftonline.us` for Azure Government.

Example custom manager:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/(^|/)images\\.ya?ml$/"],
      "matchStrings": [
        "# renovate: datasource=(?<datasource>azure-compute-gallery) packageName=(?<packageName>\\{.*?\\}) depName=(?<depName>[^\\s]+)\\nimageVersion: (?<currentValue>[^\\s]+)"
      ],
      "versioningTemplate": "loose"
    }
  ]
}
```
