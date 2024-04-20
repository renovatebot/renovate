### Supported dependencies

Renovate supports updating the Terraform dependencies listed below.
Check the tables to see where some dependencies can be hosted.

#### Modules

| Name              | Public hosting | Private hosting |
| ----------------- | :------------: | :-------------: |
| GitTags           |      yes       |       yes       |
| GithubTags        |      yes       |       yes       |
| TerraformRegistry |      yes       |       yes       |

#### Providers

Providers are deprecated in Terraform `0.13.0`.

| Name              | Public hosting | Private hosting |
| ----------------- | :------------: | :-------------: |
| TerraformRegistry |      yes       |       yes       |

#### required_providers block

Needs Terraform `>= 0.13.0`.

| Name              | Public hosting | Private hosting |
| ----------------- | :------------: | :-------------: |
| TerraformRegistry |      yes       |       yes       |

#### required_version

Renovate can update the `required_version` attribute of the Terraform block.

#### helm_release

Renovate can update the version attribute of `helm_release` resources. This applies to both helm chart repositories and [charts published in OCI registries](https://helm.sh/docs/topics/registries/).

| Name             | Public hosting | Private hosting |
| ---------------- | :------------: | :-------------: |
| chart repository |      yes       |       yes       |

#### Docker

Renovate can update image references of the Docker provider resources (`docker\_\*`).

| Name            | Public hosting | Private hosting |
| --------------- | :------------: | :-------------: |
| Docker registry |      yes       |       yes       |

#### Kubernetes

Renovate can update image references of Kubernetes provider resources (`kubernetes\_\*`).

| Name            | Public hosting | Private hosting |
| --------------- | :------------: | :-------------: |
| Docker registry |      yes       |       yes       |

#### tfe_workspaces

Renovate can update [tfe_workspaces](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace).
Renovate searches for the `terraform_version` argument.

### Range constraints

Renovate understands these Terraform range constraints:

| Terraform range      | Notes                                                       |
| -------------------- | ----------------------------------------------------------- |
| `>= 1.2.0`           | version `1.2.0` or newer                                    |
| `<= 1.2.0`           | version `1.2.0` or older                                    |
| `~> 1.2.0`           | any non-beta version `>= 1.2.0` and `< 1.3.0`, e.g. `1.2.X` |
| `~> 1.2`             | any non-beta version `>= 1.2.0` and `< 2.0.0`, e.g. `1.X.Y` |
| `>= 1.0.0, <= 2.0.0` | any version between `1.0.0` and `2.0.0` inclusive           |

### Disabling parts of the manager

You can use these `depTypes` for fine-grained control, for example to disable parts of the Terraform manager.

| Resource                             |               `depType`                |                                   Notes                                    |
| ------------------------------------ | :------------------------------------: | :------------------------------------------------------------------------: |
| Terraform provider                   |               `provider`               |                                                                            |
| required Terraform provider          |          `required_provider`           |                                                                            |
| required Terraform version           |           `required_version`           |          This handles the `required_version` in terraform blocks           |
| TFE workspace                        |            `tfe_workspace`             | This handles the `terraform_version` argument in `tfe_workspace` resources |
| Terraform module                     |                `module`                |                                                                            |
| Helm release                         |             `helm_release`             |                                                                            |
| Docker container                     |           `docker_container`           |                                                                            |
| Docker image                         |             `docker_image`             |                                                                            |
| Docker service                       |            `docker_service`            |                                                                            |
| Kubernetes CronJob                   |         `kubernetes_cron_job`          |                                                                            |
| Kubernetes CronJob v1                |        `kubernetes_cron_job_v1`        |                                                                            |
| Kubernetes DaemonSet                 |        `kubernetes_daemon_set`         |                                                                            |
| Kubernetes DaemonSet v1              |       `kubernetes_daemon_set_v1`       |                                                                            |
| Kubernetes Deployment                |        `kubernetes_deployment`         |                                                                            |
| Kubernetes Deployment v1             |       `kubernetes_deployment_v1`       |                                                                            |
| Kubernetes Job                       |            `kubernetes_job`            |                                                                            |
| Kubernetes Job v1                    |          `kubernetes_job_v1`           |                                                                            |
| Kubernetes Pod                       |            `kubernetes_pod`            |                                                                            |
| Kubernetes Pod v1                    |          `kubernetes_pod_v1`           |                                                                            |
| Kubernetes Replication Controller    |  `kubernetes_replication_controller`   |                                                                            |
| Kubernetes Replication Controller v1 | `kubernetes_replication_controller_v1` |                                                                            |
| Kubernetes StatefulSet               |       `kubernetes_stateful_set`        |                                                                            |
| Kubernetes StatefulSet v1            |      `kubernetes_stateful_set_v1`      |                                                                            |

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
