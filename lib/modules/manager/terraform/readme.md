### Terraform vs OpenTofu

Renovate can not know if you want to use the Terraform or OpenTofu registry.
By default, Renovate uses the Terraform registry (`registry.terraform.io`) for providers and modules _without_ a registry definition.

You can override this default with your own `packageRules`, for example:

```json title="Prefer releases from OpenTofu"
{
  "packageRules": [
    {
      "matchDatasources": ["terraform-provider", "terraform-module"],
      "registryUrls": ["https://registry.opentofu.org"]
    }
  ]
}
```

### Supported dependencies

Renovate supports updating the Terraform dependencies listed below.
Check the tables to see where some dependencies can be hosted.

#### Modules

| Name              | Public hosting | Private hosting |
| ----------------- | :------------: | :-------------: |
| GitTags           |      yes       |       yes       |
| GithubTags        |      yes       |       yes       |
| TerraformRegistry |      yes       |       yes       |

##### Dynamic module `source`/`version`

Terraform `1.15` and OpenTofu `1.8` let you use a `local` value or an input `variable` as the whole value of the `ref` of a module `source` (the `ref=` part of a Git-style source URL) or of the `version` attribute.
Terraform requires the `variable` to have `const = true` for this, so a plain `variable` does not work there.
OpenTofu does not need `const`.
Renovate does not check `const`, so it works for both tools.

```hcl
variable "module_version" {
  type    = string
  const   = true
  default = "v1.2.3"
}

module "example" {
  source = "github.com/hashicorp/example?ref=${var.module_version}"
}
```

When Renovate finds a `${local.x}` or `${var.x}` reference used as the **entire** `ref`/`version` value, it resolves the reference to the matching `locals` value or to the `default` of the matching `variable` block.
Terraform treats all files of a directory as one module, so the declaration can be in the same file as the module or in another `.tf`/`.tofu` file of the **same directory**, for example `variables.tf` or `locals.tf`.
Declarations in other directories are not used.
Renovate then proposes updates to the `locals`/`variable` declaration itself, instead of the `source` line of the module.

Renovate updates the `default` of the `variable` block, in the file that declares it.
That file must be matched by `managerFilePatterns`, which is the case with the default patterns.
If the value comes from `*.tfvars`, `-var` or `TF_VAR_*`, Renovate bumps a `default` that is not used.

The dependency is skipped with the reason `contains-variable` when:

- Renovate cannot resolve the reference, for example because the declaration is in a different directory, the `variable` has no `default`, or the value is not a plain string.
- The resolved value is itself a reference, such as a local that points to another local.
- One local or variable is shared by modules that come from different repositories (or different registry modules), because an update for one module would also change the others.
  Modules from different folders of the same repository can share a local or variable.

When the declaration is in a different file than the module, the module itself is reported as skipped with `contains-variable`, and the update is proposed for the declaration in its own file.

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

| Data Source           |        `depType`        | Notes |
| --------------------- | :---------------------: | :---: |
| Docker registry image | `docker_registry_image` |       |

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
