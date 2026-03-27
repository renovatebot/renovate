import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'module',
    description: 'A Terraform module source reference',
  },
  {
    depType: 'provider',
    description: 'A Terraform provider declared in a `provider` block',
  },
  {
    depType: 'required_provider',
    description:
      'A Terraform provider declared in a `required_providers` block',
  },
  {
    depType: 'required_version',
    description:
      'The Terraform version constraint in a `required_version` field',
  },
  {
    depType: 'helm_release',
    description: 'A Helm chart deployed via a `helm_release` resource',
  },
  {
    depType: 'tfe_workspace',
    description: 'A Terraform version pinned in a `tfe_workspace` resource',
  },
  {
    depType: 'docker_image',
    description: 'A Docker image in a `docker_image` resource',
  },
  {
    depType: 'docker_container',
    description: 'A Docker image in a `docker_container` resource',
  },
  {
    depType: 'docker_service',
    description: 'A Docker image in a `docker_service` resource',
  },
  {
    depType: 'docker_registry_image',
    description: 'A Docker image in a `docker_registry_image` data source',
  },
  {
    depType: 'kubernetes_pod',
    description: 'A container image in a `kubernetes_pod` resource',
  },
  {
    depType: 'kubernetes_pod_v1',
    description: 'A container image in a `kubernetes_pod_v1` resource',
  },
  {
    depType: 'kubernetes_cron_job',
    description: 'A container image in a `kubernetes_cron_job` resource',
  },
  {
    depType: 'kubernetes_cron_job_v1',
    description: 'A container image in a `kubernetes_cron_job_v1` resource',
  },
  {
    depType: 'kubernetes_daemonset',
    description: 'A container image in a `kubernetes_daemonset` resource',
  },
  {
    depType: 'kubernetes_daemon_set_v1',
    description: 'A container image in a `kubernetes_daemon_set_v1` resource',
  },
  {
    depType: 'kubernetes_deployment',
    description: 'A container image in a `kubernetes_deployment` resource',
  },
  {
    depType: 'kubernetes_deployment_v1',
    description: 'A container image in a `kubernetes_deployment_v1` resource',
  },
  {
    depType: 'kubernetes_job',
    description: 'A container image in a `kubernetes_job` resource',
  },
  {
    depType: 'kubernetes_job_v1',
    description: 'A container image in a `kubernetes_job_v1` resource',
  },
  {
    depType: 'kubernetes_replication_controller',
    description:
      'A container image in a `kubernetes_replication_controller` resource',
  },
  {
    depType: 'kubernetes_replication_controller_v1',
    description:
      'A container image in a `kubernetes_replication_controller_v1` resource',
  },
  {
    depType: 'kubernetes_stateful_set',
    description: 'A container image in a `kubernetes_stateful_set` resource',
  },
  {
    depType: 'kubernetes_stateful_set_v1',
    description: 'A container image in a `kubernetes_stateful_set_v1` resource',
  },
] as const satisfies readonly DepTypeMetadata[];

export type TerraformDepType = (typeof knownDepTypes)[number]['depType'];
