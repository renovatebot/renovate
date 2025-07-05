import { z } from 'zod';

export type TfLiteral =
  | string
  | number
  | boolean
  | null
  | { [k: string]: TfLiteral }
  | TfLiteral[];

export const tfLiteral: z.ZodType<TfLiteral> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(oneOrMany(tfLiteral)),
    z.record(tfLiteral),
  ]),
);

const NORMALISE_KEYS = new Set([
  'metadata',
  'spec',
  'template',
  'job_template',
  'container',
  'init_container',
  'selector',
]);

function normalise(node: any): any {
  if (Array.isArray(node)) {
    let arr: any[] = node;
    while (arr.length === 1 && Array.isArray(arr[0])) {
      arr = arr[0];
    }
    return arr.map(normalise);
  }

  if (node && typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      let val = normalise(v);
      if (NORMALISE_KEYS.has(k)) {
        val = Array.isArray(val) ? val : [val];
      }
      out[k] = val;
    }
    return out;
  }

  return node;
}

const oneOrMany: any = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.array(schema)])
    .transform((v) => (Array.isArray(v) ? v : [v]));

export const TerraformRequiredProvider = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

export const TerraformRequiredProviderBlock = z.record(
  z.union([TerraformRequiredProvider, z.string()]),
);

export const TerraformBlock = z.object({
  required_providers: oneOrMany(TerraformRequiredProviderBlock).optional(),
  required_version: z.string().optional(),
});

export const TerraformModule = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

export const TerraformProvider = z.object({
  alias: z.string().optional(),
  version: z.string().optional(),
});

export const TerraformHelmRelease = z.object({
  version: z.string().optional(),
  repository: z.string().optional(),
  chart: z.string().optional(),
});

export const TerraformWorkspace = z.object({
  terraform_version: z.string().optional(),
});

export const TerraformWorkspaceArray = oneOrMany(TerraformWorkspace);

const DockerSimpleInstance = z.record(tfLiteral);
const DockerContainerSpec = z.record(tfLiteral);
const DockerTaskSpec = z
  .object({
    container_spec: oneOrMany(DockerContainerSpec).optional(),
  })
  .catchall(tfLiteral);
const DockerPortsSpec = z.record(tfLiteral);
const DockerEndpointSpec = z
  .object({
    ports: oneOrMany(DockerPortsSpec).optional(),
  })
  .catchall(tfLiteral);

const DockerServiceInstance = z
  .object({
    name: z.string().optional(),
    task_spec: oneOrMany(DockerTaskSpec).optional(),
    endpoint_spec: oneOrMany(DockerEndpointSpec).optional(),
  })
  .catchall(tfLiteral);

const GenericResourceInstance = z.record(tfLiteral);
const GenericResourceSchema = z.record(oneOrMany(GenericResourceInstance));

const KubernetesInstance = z.any().transform((orig) => {
  const n = normalise(orig);
  return Array.isArray(n) ? n : [n];
});

export const KubernetesCronJob = KubernetesInstance;
export const KubernetesCronJobV1 = KubernetesInstance;
export const KubernetesDaemonSet = KubernetesInstance;
export const KubernetesDaemonSetV1 = KubernetesInstance;
export const KubernetesDeployment = KubernetesInstance;
export const KubernetesDeploymentV1 = KubernetesInstance;
export const KubernetesJob = KubernetesInstance;
export const KubernetesJobV1 = KubernetesInstance;
export const KubernetesPod = KubernetesInstance;
export const KubernetesPodV1 = KubernetesInstance;
export const KubernetesReplicationController = KubernetesInstance;
export const KubernetesReplicationControllerV1 = KubernetesInstance;
export const KubernetesStatefulSet = KubernetesInstance;
export const KubernetesStatefulSetV1 = KubernetesInstance;

export const TerraformResources = z
  .object({
    helm_release: z.record(TerraformHelmRelease).optional(),
    docker_container: z.record(oneOrMany(DockerSimpleInstance)).optional(),

    docker_image: z.record(oneOrMany(DockerSimpleInstance)).optional(),

    docker_service: z.record(oneOrMany(DockerServiceInstance)).optional(),
    kubernetes_cron_job_v1: z.record(oneOrMany(KubernetesCronJobV1)).optional(),
    kubernetes_cron_job: z.record(oneOrMany(KubernetesCronJob)).optional(),
    kubernetes_daemon_set_v1: z
      .record(oneOrMany(KubernetesDaemonSetV1))
      .optional(),
    kubernetes_daemonset: z.record(oneOrMany(KubernetesDaemonSet)).optional(),
    kubernetes_deployment: z.record(oneOrMany(KubernetesDeployment)).optional(),
    kubernetes_deployment_v1: z
      .record(oneOrMany(KubernetesDeploymentV1))
      .optional(),
    kubernetes_job: z.record(oneOrMany(KubernetesJob)).optional(),
    kubernetes_job_v1: z.record(oneOrMany(KubernetesJobV1)).optional(),
    kubernetes_pod: z.record(oneOrMany(KubernetesPod)).optional(),
    kubernetes_pod_v1: z.record(oneOrMany(KubernetesPodV1)).optional(),
    kubernetes_replication_controller: z
      .record(oneOrMany(KubernetesReplicationController))
      .optional(),
    kubernetes_replication_controller_v1: z
      .record(oneOrMany(KubernetesReplicationControllerV1))
      .optional(),
    kubernetes_stateful_set: z
      .record(oneOrMany(KubernetesStatefulSet))
      .optional(),
    kubernetes_stateful_set_v1: z
      .record(oneOrMany(KubernetesStatefulSetV1))
      .optional(),
    tfe_workspace: z.record(TerraformWorkspaceArray).optional(),
  })
  .catchall(GenericResourceSchema)
  .optional();

export const TerraformDefinitionFileJSON = z
  .object({
    terraform: oneOrMany(TerraformBlock).optional(),

    module: z.record(oneOrMany(TerraformModule)).optional(),

    resource: TerraformResources.optional(),

    data: z.record(tfLiteral).optional(),

    provider: z.record(oneOrMany(TerraformProvider)).optional(),
  })
  .strict();

export type KubernetesCronJobV1 = z.infer<typeof KubernetesCronJobV1>;
export type KubernetesCronJob = z.infer<typeof KubernetesCronJob>;
export type KubernetesDaemonSetV1 = z.infer<typeof KubernetesDaemonSetV1>;
export type KubernetesDaemonSet = z.infer<typeof KubernetesDaemonSet>;
export type KubernetesDeployment = z.infer<typeof KubernetesDeployment>;
export type KubernetesDeploymentV1 = z.infer<typeof KubernetesDeploymentV1>;
export type KubernetesJob = z.infer<typeof KubernetesJob>;
export type KubernetesJobV1 = z.infer<typeof KubernetesJobV1>;
export type KubernetesPod = z.infer<typeof KubernetesPod>;
export type KubernetesPodV1 = z.infer<typeof KubernetesPodV1>;
export type KubernetesReplicationController = z.infer<
  typeof KubernetesReplicationController
>;
export type KubernetesReplicationControllerV1 = z.infer<
  typeof KubernetesReplicationControllerV1
>;
export type KubernetesStatefulSet = z.infer<typeof KubernetesStatefulSet>;
export type KubernetesStatefulSetV1 = z.infer<typeof KubernetesStatefulSetV1>;

export type TerraformBlock = z.infer<typeof TerraformBlock>;
export type TerraformModule = z.infer<typeof TerraformModule>;
export type TerraformProvider = z.infer<typeof TerraformProvider>;
export type TerraformResources = z.infer<typeof TerraformResources>;
export type TerraformHelmRelease = z.infer<typeof TerraformHelmRelease>;
export type TerraformWorkspace = z.infer<typeof TerraformWorkspace>;
export type TerraformRequiredProvider = z.infer<
  typeof TerraformRequiredProvider
>;
export type TerraformRequiredProviderBlock = z.infer<
  typeof TerraformRequiredProviderBlock
>;
export type TerraformDefinitionFileJSON = z.infer<
  typeof TerraformDefinitionFileJSON
>;
