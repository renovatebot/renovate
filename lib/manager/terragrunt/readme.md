Currently Terragrunt support is limited to Terraform registry sources and github sources that include semver refs, e.g. like `github.com/hashicorp/example?ref=v1.0.0`.

Fixed Terragrunt versions like the following will receive a PR whenever there is a newer version available:

```hcl
terraform {
  source = "github.com/hashicorp/example?ref=v1.0.0"
}
```
