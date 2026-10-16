import type { GenericImageResourceDef } from '../../types.ts';

const KubernetesSpecContainer = ['spec', 'container', 'image'];
const KubernetesSpecInitContainer = ['spec', 'init_container', 'image'];
const KubernetesSpecTemplate = [
  'spec',
  'template',
  'spec',
  'container',
  'image',
];
const KubernetesSpecTemplateInit = [
  'spec',
  'template',
  'spec',
  'init_container',
  'image',
];
const KubernetesJobTemplate = [
  'spec',
  'job_template',
  'spec',
  'template',
  'spec',
  'container',
  'image',
];
const KubernetesJobTemplateInit = [
  'spec',
  'job_template',
  'spec',
  'template',
  'spec',
  'init_container',
  'image',
];
const GoogleCloudRunV1Container = ['template', 'spec', 'containers', 'image'];
const GoogleCloudRunV2Container = ['template', 'containers', 'image'];
const GoogleCloudRunV2JobContainer = ['template', ...GoogleCloudRunV2Container];
const GoogleCloudRunV2SandboxTemplate = [
  'template',
  'sandboxes',
  'templates',
  'image',
];
const GoogleDataplexContainerImage = [
  'infrastructure_spec',
  'container_image',
  'image',
];
const GoogleRuntimeConfigContainerImage = ['runtime_config', 'container_image'];
const GoogleCloudDeployTaskContainer = ['tasks', 'container', 'image'];

export const generic_image_datasource: GenericImageResourceDef[] = [
  { type: 'docker_registry_image', path: ['name'] },
];

export const generic_image_resource: GenericImageResourceDef[] = [
  // Docker provider: https://registry.terraform.io/providers/kreuzwerker/docker
  { type: 'docker_image', path: ['name'] },
  { type: 'docker_container', path: ['image'] },
  { type: 'docker_service', path: ['task_spec', 'container_spec', 'image'] },
  // Kubernetes provider: https://registry.terraform.io/providers/hashicorp/kubernetes
  { type: 'kubernetes_pod', path: KubernetesSpecContainer },
  { type: 'kubernetes_pod', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_pod_v1', path: KubernetesSpecContainer },
  { type: 'kubernetes_pod_v1', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_cron_job', path: KubernetesJobTemplate },
  { type: 'kubernetes_cron_job', path: KubernetesJobTemplateInit },
  { type: 'kubernetes_cron_job_v1', path: KubernetesJobTemplate },
  { type: 'kubernetes_cron_job_v1', path: KubernetesJobTemplateInit },
  { type: 'kubernetes_daemonset', path: KubernetesSpecTemplate },
  { type: 'kubernetes_daemonset', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_daemon_set_v1', path: KubernetesSpecTemplate },
  { type: 'kubernetes_daemon_set_v1', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_deployment', path: KubernetesSpecTemplate },
  { type: 'kubernetes_deployment', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_deployment_v1', path: KubernetesSpecTemplate },
  { type: 'kubernetes_deployment_v1', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_job', path: KubernetesSpecTemplate },
  { type: 'kubernetes_job', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_job_v1', path: KubernetesSpecTemplate },
  { type: 'kubernetes_job_v1', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_cron_job', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_cron_job', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_cron_job_v1', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_cron_job_v1', path: KubernetesSpecInitContainer },
  { type: 'kubernetes_replication_controller', path: KubernetesSpecTemplate },
  {
    type: 'kubernetes_replication_controller',
    path: KubernetesSpecTemplateInit,
  },
  {
    type: 'kubernetes_replication_controller_v1',
    path: KubernetesSpecTemplate,
  },
  {
    type: 'kubernetes_replication_controller_v1',
    path: KubernetesSpecTemplateInit,
  },
  { type: 'kubernetes_stateful_set', path: KubernetesSpecTemplate },
  { type: 'kubernetes_stateful_set', path: KubernetesSpecTemplateInit },
  { type: 'kubernetes_stateful_set_v1', path: KubernetesSpecTemplate },
  { type: 'kubernetes_stateful_set_v1', path: KubernetesSpecTemplateInit },
  // Google provider: https://registry.terraform.io/providers/hashicorp/google
  { type: 'google_cloud_run_service', path: GoogleCloudRunV1Container },
  { type: 'google_cloud_run_v2_service', path: GoogleCloudRunV2Container },
  {
    type: 'google_cloud_run_v2_service',
    path: GoogleCloudRunV2SandboxTemplate,
  },
  { type: 'google_cloud_run_v2_worker_pool', path: GoogleCloudRunV2Container },
  { type: 'google_cloud_run_v2_job', path: GoogleCloudRunV2JobContainer },
  {
    type: 'google_app_engine_flexible_app_version',
    path: ['deployment', 'container', 'image'],
  },
  {
    type: 'google_workstations_workstation_config',
    path: ['container', 'image'],
  },
  {
    type: 'google_dataproc_batch',
    path: GoogleRuntimeConfigContainerImage,
  },
  {
    type: 'google_dataproc_session_template',
    path: GoogleRuntimeConfigContainerImage,
  },
  {
    type: 'google_dataplex_task',
    path: ['spark', ...GoogleDataplexContainerImage],
  },
  {
    type: 'google_dataplex_task',
    path: ['notebook', ...GoogleDataplexContainerImage],
  },
  {
    type: 'google_vertex_ai_reasoning_engine',
    path: ['spec', 'container_spec', 'image_uri'],
  },
  {
    type: 'google_vertex_ai_endpoint_with_model_garden_deployment',
    path: ['model_config', 'container_spec', 'image_uri'],
  },
  {
    type: 'google_firebase_app_hosting_build',
    path: ['source', 'container', 'image'],
  },
  {
    type: 'google_bigquery_routine',
    path: ['spark_options', 'container_image'],
  },
  { type: 'google_cloudbuild_trigger', path: ['build', 'step', 'name'] },
  {
    type: 'google_network_services_wasm_plugin',
    path: ['versions', 'image_uri'],
  },
  {
    type: 'google_dataproc_gdc_spark_application',
    path: ['dependency_images'],
  },
  {
    type: 'google_clouddeploy_custom_target_type',
    path: ['tasks', 'deploy', 'container', 'image'],
  },
  {
    type: 'google_clouddeploy_custom_target_type',
    path: ['tasks', 'render', 'container', 'image'],
  },
  {
    type: 'google_clouddeploy_delivery_pipeline',
    path: [
      'serial_pipeline',
      'stages',
      'strategy',
      'canary',
      'canary_deployment',
      'verify_config',
      ...GoogleCloudDeployTaskContainer,
    ],
  },
  {
    type: 'google_clouddeploy_delivery_pipeline',
    path: [
      'serial_pipeline',
      'stages',
      'strategy',
      'canary',
      'custom_canary_deployment',
      'phase_configs',
      'verify_config',
      ...GoogleCloudDeployTaskContainer,
    ],
  },
  {
    type: 'google_clouddeploy_delivery_pipeline',
    path: [
      'serial_pipeline',
      'stages',
      'strategy',
      'standard',
      'predeploy',
      ...GoogleCloudDeployTaskContainer,
    ],
  },
  {
    type: 'google_clouddeploy_delivery_pipeline',
    path: [
      'serial_pipeline',
      'stages',
      'strategy',
      'standard',
      'postdeploy',
      ...GoogleCloudDeployTaskContainer,
    ],
  },
  {
    type: 'google_clouddeploy_delivery_pipeline',
    path: [
      'serial_pipeline',
      'stages',
      'strategy',
      'standard',
      'verify_config',
      ...GoogleCloudDeployTaskContainer,
    ],
  },
];
