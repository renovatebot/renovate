[endoflife.date](https://endoflife.date) provides version and end-of-life information for different packages.

To find the appropriate "package" name for the software you're trying to update, use the endoflife.date "All packages" API endpoint. You can find it in [the API documentation](https://endoflife.date/docs/api).

This datasource uses `loose` versioning by default. If the software you are upgrading supports a versioning that is more strict, e.g. `semver`, it is recommended to specify that explicitly.

**Usage Example**

Imagine using Amazon EKS and wanting to update the versions in a terraform `.tfvars` file.

An example `.tfvars` file would look as follows:

```hcl
# renovate: datasource=endoflife-date depName=amazon-eks versioning=loose
kubernetes_version = "1.26"
```

then, add the following configuration to your `renovate.json`:

```json
{
  "regexManagers": [
    {
      "fileMatch": ["^Dockerfile$"],
      "matchStrings": [
        "#\\s*renovate:\\s*datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=\"(?<currentValue>.*)\"\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{/if}}"
    }
  ]
}
```
