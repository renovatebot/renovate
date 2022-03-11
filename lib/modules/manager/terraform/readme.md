Currently, Terraform supports renovating the following dependencies, where sub points represent hosting options of the dependencies:

- modules
  - GitTags
  - GithubTags
  - TerraformRegistry ( Public and Private )
- providers ( deprecated in Terraform 0.13.0 )
  - TerraformRegistry ( Public and Private )
- required_providers block ( Terraform >= 0.13.0)
  - TerraformRegistry ( Public and Private )
- required_version
- helm_release
  - chart repository ( Public and Private )
- docker\_\*
  - Docker registry ( Public and Private )
- [tfe_workspace](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace) ( `terraform_version` argument )

Terraform range constraints are supported:

- `>= 1.2.0`: version 1.2.0 or newer
- `<= 1.2.0`: version 1.2.0 or older
- `~> 1.2.0`: any non-beta version >= 1.2.0 and < 1.3.0, e.g. 1.2.X
- `~> 1.2`: any non-beta version >= 1.2.0 and < 2.0.0, e.g. 1.X.Y
- `>= 1.0.0, <= 2.0.0`: any version between 1.0.0 and 2.0.0 inclusive

For fine-grained control, e.g. to turn off only parts of this manager, you can use the following `depTypes`:

| resource                    |       depType       |                                                        Notes                                                         |
| --------------------------- | :-----------------: | :------------------------------------------------------------------------------------------------------------------: |
| Terraform provider          |     `provider`      |                                                                                                                      |
| required Terraform provider | `required_provider` |                                                                                                                      |
| required Terraform version  | `required_version`  | This handles both `required_version` in terraform blocks as well as `terraform_version` in `tfe_workspace` resources |
| Terraform module            |      `module`       |                                                                                                                      |
| Helm release                |   `helm_release`    |                                                                                                                      |
| Docker container            | `docker_container`  |                                                                                                                      |
| Docker image                |   `docker_image`    |                                                                                                                      |
| Docker service              |  `docker_service`   |                                                                                                                      |

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
