Currently by default, Terragrunt support is limited to Terraform registry sources and GitHub sources that include SemVer refs, e.g. like `github.com/hashicorp/example?ref=v1.0.0`.

You can create a custom [versioning config](/configuration-options/#versioning) to support non-SemVer references.
For example, if you want to reference a tag like `module-v1.2.5`, a block like this would work:

```json
"terraform": {
 "versioning": "regex:^((?<compatibility>.*)-v|v*)(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$"
}
```

Pinned Terragrunt dependencies like the following will receive a PR whenever there is a newer version available:

```hcl
terraform {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}
```
