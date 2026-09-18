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
  {
    depType: 'google_cloud_run_service',
    description: 'A container image in a `google_cloud_run_service` resource',
  },
  {
    depType: 'google_cloud_run_v2_service',
    description:
      'A container image in a `google_cloud_run_v2_service` resource',
  },
  {
    depType: 'google_cloud_run_v2_worker_pool',
    description:
      'A container image in a `google_cloud_run_v2_worker_pool` resource',
  },
  {
    depType: 'google_cloud_run_v2_job',
    description: 'A container image in a `google_cloud_run_v2_job` resource',
  },
  {
    depType: 'google_app_engine_flexible_app_version',
    description:
      'A container image in a `google_app_engine_flexible_app_version` resource',
  },
  {
    depType: 'google_workstations_workstation_config',
    description:
      'A container image in a `google_workstations_workstation_config` resource',
  },
  {
    depType: 'google_dataproc_batch',
    description: 'A container image in a `google_dataproc_batch` resource',
  },
  {
    depType: 'google_dataproc_session_template',
    description:
      'A container image in a `google_dataproc_session_template` resource',
  },
  {
    depType: 'google_dataplex_task',
    description: 'A container image in a `google_dataplex_task` resource',
  },
  {
    depType: 'google_vertex_ai_reasoning_engine',
    description:
      'A container image in a `google_vertex_ai_reasoning_engine` resource',
  },
  {
    depType: 'google_vertex_ai_endpoint_with_model_garden_deployment',
    description:
      'A container image in a `google_vertex_ai_endpoint_with_model_garden_deployment` resource',
  },
  {
    depType: 'google_firebase_app_hosting_build',
    description:
      'A container image in a `google_firebase_app_hosting_build` resource',
  },
  {
    depType: 'google_bigquery_routine',
    description: 'A container image in a `google_bigquery_routine` resource',
  },
  {
    depType: 'google_cloudbuild_trigger',
    description: 'A container image in a `google_cloudbuild_trigger` resource',
  },
  {
    depType: 'google_network_services_wasm_plugin',
    description:
      'A container image in a `google_network_services_wasm_plugin` resource',
  },
  {
    depType: 'google_dataproc_gdc_spark_application',
    description:
      'A container image in a `google_dataproc_gdc_spark_application` resource',
  },
  {
    depType: 'google_clouddeploy_custom_target_type',
    description:
      'A container image in a `google_clouddeploy_custom_target_type` resource',
  },
  {
    depType: 'google_clouddeploy_delivery_pipeline',
    description:
      'A container image in a `google_clouddeploy_delivery_pipeline` resource',
  },
] as const satisfies readonly DepTypeMetadata[];
