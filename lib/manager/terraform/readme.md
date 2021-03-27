Currently Terraform support is limited to Terraform registry sources and GitHub sources that include SemVer refs, e.g. like `github.com/hashicorp/example?ref=v1.0.0`.

Fixed versions like the following will receive a PR whenever there is a newer version available:

```
module "consul" {
  source  = "hashicorp/consul/aws"
  version = "0.0.5"
  servers = 3
}
```

The following _range_ constraints are also supported:

- `>= 1.2.0`: version 1.2.0 or newer
- `<= 1.2.0`: version 1.2.0 or older
- `~> 1.2.0`: any non-beta version >= 1.2.0 and < 1.3.0, e.g. 1.2.X
- `~> 1.2`: any non-beta version >= 1.2.0 and < 2.0.0, e.g. 1.X.Y
- `>= 1.0.0`, <= 2.0.0`: any version between 1.0.0 and 2.0.0 inclusive

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
