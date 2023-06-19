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

Given the above `.tfvars` file, you put this in your `renovate.json`:

```json
{
  "regexManagers": [
    {
      "description": "Update Kubernetes version for Amazon EKS in tfvars files",
      "fileMatch": [".+\\.tfvars$"],
      "matchStrings": [
        "#\\s*renovate:\\s*datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\s.*?_version\\s*=\\s*\"(?<currentValue>.*)\""
      ],
      "versioningTemplate": "{{#if versioning}}{{{versioning}}}{{/if}}"
    }
  ],
  "packageRules": [
    {
      "matchDatasources": ["endoflife-date"],
      "matchPackageNames": ["amazon-eks"],
      "extractVersion": "^(?<version>.*)-eks.+$"
    }
  ]
}
```

With this configuration, Renovate will parse all `*.tfvars` files in the repository.
It will then update variables that end with `_version` and have the `# renovate: datasource=endoflife-date depName=dependency-name versioning=versioning` comment set in the line above when any new versions are available.

For `amazon-eks`, the defined `packageRule` above will also strip the `-eks-${eks-release-version}` suffix to only set the Kubernetes minor version.
