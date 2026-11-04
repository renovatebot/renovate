Artifactory is the recommended registry for Conan packages.

This datasource returns releases from given custom `registryUrl`(s).

The target URL is composed by the `registryUrl` and the `packageName`.

The release timestamp is taken from the date in the directory listing, and is assumed to be in UTC time.

Directory listings often contain file names instead of plain version numbers.
Use [`extractVersion`](../../../configuration-options.md#extractversion) to get the version from the file name.
For example, this custom manager updates a URL like `https://artifactory.example.com/artifactory/my-repo/path/to/api/api-definition_v1.2.3.yaml`:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^openapi\\.ts$/"],
      "matchStrings": [
        "'(?<registryUrl>https://[^'/]+/artifactory/[^'/]+/)(?<packageName>[^']+/)(?<filePrefix>[a-z-]+_)(?<currentValue>v?[0-9.]+)\\.yaml'"
      ],
      "datasourceTemplate": "artifactory",
      "extractVersionTemplate": "^{{{filePrefix}}}(?<version>v?[0-9.]+)\\.yaml$"
    }
  ]
}
```

Here `extractVersionTemplate` turns the listed file `api-definition_v1.2.3.yaml` into the version `v1.2.3`.
`currentValue` is captured as `v1.2.3` directly, because `extractVersion` is not applied to it.
