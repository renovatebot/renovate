[endoflife.date](https://endoflife.date) provides version and end-of-life information for different packages.

To find the appropriate "package" name for the software you're trying to update, use the endoflife.date "All packages" API endpoint.
You can find it in [the endoflife.date API documentation](https://endoflife.date/docs/api).

By default, this datasource uses `loose` versioning.
If possible, we recommend you use a stricter versioning like `semver` instead of `loose`.

**Usage Example**

Say you're using Amazon EKS and want Renovate to update the versions in a Terraform `.tfvars` file.
For example, you have this `.tfvars` file:

```hcl
# renovate: datasource=endoflife-date depName=amazon-eks versioning=loose
kubernetes_version = "1.26"
```

Give the above `.tfvars` file, you put this in your `renovate.json`:

```json
{
  "regexManagers": [
    {
      "fileMatch": [".+\\.tfvars$"],
      "matchStrings": [
        "#\\s*renovate:\\s*datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\sENV .*?_VERSION=\"(?<currentValue>.*)\"\\s"
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{/if}}"
    }
  ]
}
```
