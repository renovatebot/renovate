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

Terraform range constraints are supported:

- `>= 1.2.0`: version 1.2.0 or newer
- `<= 1.2.0`: version 1.2.0 or older
- `~> 1.2.0`: any non-beta version >= 1.2.0 and < 1.3.0, e.g. 1.2.X
- `~> 1.2`: any non-beta version >= 1.2.0 and < 2.0.0, e.g. 1.X.Y
- `>= 1.0.0, <= 2.0.0`: any version between 1.0.0 and 2.0.0 inclusive

For fine-grained control, e.g. to turn off only parts of this manager, there are following `depTypes` provided:

| resource                    |      depType      |
| --------------------------- | :---------------: |
| terraform provider          |     provider      |
| required terraform provider | required_provider |
| required terraform version  | required_version  |
| terraform module            |      module       |
| helm release                |   helm_release    |
| docker container            | docker_container  |
| docker image                |   docker_image    |
| docker service              |  docker_service   |

If you need to change the versioning format, read the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation to learn more.
