// FIXME #12556
/* eslint-disable @typescript-eslint/naming-convention */

// eslint-disable-next-line typescript-enum/no-enum
export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
  required_providers = 'required_providers',
  resource = 'resource',
  terraform_version = 'terraform_version',
}

export const TerraformResourceTypes: Record<string, string[]> = {
  unknown: ['unknown'],
  generic_image_resource: [
    // Docker provider: https://registry.terraform.io/providers/kreuzwerker/docker
    'docker_container',
    'docker_service',
    // Kubernetes provider: https://registry.terraform.io/providers/hashicorp/kubernetes
    'kubernetes_cron_job',
    'kubernetes_cron_job_v1',
    'kubernetes_daemon_set',
    'kubernetes_daemon_set_v1',
    'kubernetes_daemonset',
    'kubernetes_deployment',
    'kubernetes_deployment_v1',
    'kubernetes_job',
    'kubernetes_job_v1',
    'kubernetes_pod',
    'kubernetes_pod_v1',
    'kubernetes_replication_controller',
    'kubernetes_replication_controller_v1',
    'kubernetes_stateful_set',
    'kubernetes_stateful_set_v1',
  ],
  // https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs/resources/image
  docker_image: ['docker_image'],
  // https://registry.terraform.io/providers/hashicorp/helm/latest/docs/resources/release
  helm_release: ['helm_release'],
  // https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace
  tfe_workspace: ['tfe_workspace'],
};
