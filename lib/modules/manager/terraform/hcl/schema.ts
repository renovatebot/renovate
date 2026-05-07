import { z } from 'zod/v3';

const tfPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type TfPrimitive = z.infer<typeof tfPrimitive>;

type TfLiteral = TfPrimitive | { [k: string]: TfLiteral } | TfLiteral[];

const tfLiteral: z.ZodType<TfLiteral> = z.lazy(() =>
  z.union([tfPrimitive, z.record(tfLiteral), z.array(tfLiteral)]),
);

const NORMALIZE_KEYS = new Set([
  'metadata',
  'spec',
  'template',
  'job_template',
  'container',
  'init_container',
  'selector',
]);

function normalize(node: TfLiteral): TfLiteral {
  if (Array.isArray(node)) {
    // Recursively flatten nested arrays
    function flatten(arr: TfLiteral[]): TfLiteral[] {
      return arr.flatMap((item) =>
        Array.isArray(item) ? flatten(item) : [normalize(item)],
      );
    }
    return flatten(node);
  }

  if (node && typeof node === 'object') {
    const out: Record<string, TfLiteral> = {};
    for (const [k, v] of Object.entries(node)) {
      let val = normalize(v);
      if (NORMALIZE_KEYS.has(k)) {
        val = Array.isArray(val) ? val : [val];
      }
      out[k] = val;
    }
    return out;
  }

  return node;
}

function oneOrMany<T extends z.ZodTypeAny>(
  schema: T,
): z.ZodEffects<
  z.ZodUnion<[T, z.ZodArray<T>]>,
  z.infer<T>[],
  z.infer<T> | z.infer<T>[]
> {
  return z
    .union([schema, z.array(schema)])
    .transform((v) => (Array.isArray(v) ? v : [v]));
}

const TerraformRequiredProvider = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

const TerraformRequiredProviderBlock = z.record(
  z.union([TerraformRequiredProvider, z.string()]),
);

const TerraformBlock = z.object({
  required_providers: oneOrMany(TerraformRequiredProviderBlock).optional(),
  required_version: z.string().optional(),
});

const TerraformModule = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

const TerraformProvider = z.object({
  alias: z.string().optional(),
  version: z.string().optional(),
});

const TerraformHelmRelease = z.object({
  version: z.string().optional(),
  repository: z.string().optional(),
  chart: z.string().optional(),
});

const TerraformWorkspace = z.object({
  terraform_version: z.string().optional(),
});

const TerraformWorkspaceArray = oneOrMany(TerraformWorkspace);

const DockerSimpleInstance = z.record(tfLiteral);
const DockerTaskSpec = z
  .object({
    container_spec: oneOrMany(DockerSimpleInstance).optional(),
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

const KubernetesInstance = tfLiteral.transform((orig) => {
  const n = normalize(orig);
  return Array.isArray(n) ? n : [n];
});

const TerraformResources = z
  .object({
    helm_release: z.record(TerraformHelmRelease).optional(),
    docker_container: z.record(oneOrMany(DockerSimpleInstance)).optional(),

    docker_image: z.record(oneOrMany(DockerSimpleInstance)).optional(),

    docker_service: z.record(oneOrMany(DockerServiceInstance)).optional(),
    kubernetes_cron_job_v1: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_cron_job: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_daemon_set_v1: z
      .record(oneOrMany(KubernetesInstance))
      .optional(),
    kubernetes_daemonset: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_deployment: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_deployment_v1: z
      .record(oneOrMany(KubernetesInstance))
      .optional(),
    kubernetes_job: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_job_v1: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_pod: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_pod_v1: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_replication_controller: z
      .record(oneOrMany(KubernetesInstance))
      .optional(),
    kubernetes_replication_controller_v1: z
      .record(oneOrMany(KubernetesInstance))
      .optional(),
    kubernetes_stateful_set: z.record(oneOrMany(KubernetesInstance)).optional(),
    kubernetes_stateful_set_v1: z
      .record(oneOrMany(KubernetesInstance))
      .optional(),
    tfe_workspace: z.record(TerraformWorkspaceArray).optional(),
  })
  .catchall(GenericResourceSchema)
  .optional();

export const TerraformDefinitionFileJSON = z.object({
  terraform: oneOrMany(TerraformBlock).optional(),

  module: z.record(oneOrMany(TerraformModule)).optional(),

  resource: TerraformResources.optional(),

  data: z.record(tfLiteral).optional(),

  provider: z.record(oneOrMany(TerraformProvider)).optional(),
});
