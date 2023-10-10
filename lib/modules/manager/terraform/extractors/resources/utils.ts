import type { GenericImageResourceDef } from '../../types';

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
];
