Currently by default, Terragrunt support is limited to Terraform registry sources and github sources that include semver refs, e.g. like `github.com/hashicorp/example?ref=v1.0.0`.

It is however possible to also use custom [versioning config](../../../docs/usage/configuration-options.md#versioning) in order to support non-semver references. For example, if your want to ref a tag like `module-v1.2.5`, a block like the following would solve this issue:

```json
"terraform": {
	"versioning": "regex:^((?<compatibility>.*)-v|v*)(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)$"
}
```

Fixed Terragrunt versions like the following will receive a PR whenever there is a newer version available:

```hcl
terraform {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}
```
