import { isArray, isPlainObject } from '@sindresorhus/is';
import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
} from '../../../../util/schema-utils/index.ts';

const TfPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type TfPrimitive = z.infer<typeof TfPrimitive>;

type TfLiteral = TfPrimitive | { [k: string]: TfLiteral } | TfLiteral[];

const tfLiteral: z.ZodType<TfLiteral> = z.lazy(() =>
  z.union([TfPrimitive, z.record(z.string(), tfLiteral), z.array(tfLiteral)]),
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

function flatten(arr: TfLiteral[]): TfLiteral[] {
  return arr.flatMap((item) =>
    isArray(item) ? flatten(item) : [normalize(item)],
  );
}

function normalize(node: TfLiteral): TfLiteral {
  if (isArray(node)) {
    // Recursively flatten nested arrays
    return flatten(node);
  }

  if (isPlainObject(node)) {
    const out: Record<string, TfLiteral> = {};
    for (const [k, v] of Object.entries(node)) {
      let val = normalize(v);
      if (NORMALIZE_KEYS.has(k)) {
        val = isArray(val) ? val : [val];
      }
      out[k] = val;
    }
    return out;
  }

  return node;
}

function oneOrMany<T extends z.ZodType>(
  schema: T,
): z.ZodType<z.infer<T>[], z.input<T> | z.input<T>[]> {
  return z
    .union([schema, z.array(schema)])
    .transform((v): z.infer<T>[] => (isArray(v) ? v : [v]));
}

/**
 * Like `oneOrMany`, but invalid array elements are dropped instead of
 * failing the whole value.
 */
function looseOneOrMany<T extends z.ZodType>(
  schema: T,
): z.ZodType<z.infer<T>[]> {
  return z.union([LooseArray(schema), schema.transform((v) => [v])]);
}

const TerraformRequiredProvider = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

export type TerraformRequiredProvider = z.infer<
  typeof TerraformRequiredProvider
>;

const TerraformRequiredProviderBlock = z.record(
  z.string(),
  z.union([TerraformRequiredProvider, z.string()]),
);

export type TerraformRequiredProviderBlock = z.infer<
  typeof TerraformRequiredProviderBlock
>;

const TerraformBlock = z.object({
  required_providers: oneOrMany(TerraformRequiredProviderBlock).optional(),
  required_version: z.string().optional(),
});

export type TerraformBlock = z.infer<typeof TerraformBlock>;

const TerraformModule = z.object({
  source: z.string().optional(),
  version: z.string().optional(),
});

export type TerraformModule = z.infer<typeof TerraformModule>;

const TerraformProvider = z.object({
  alias: z.string().optional(),
  version: z.string().optional(),
});

export type TerraformProvider = z.infer<typeof TerraformProvider>;

const TerraformHelmRelease = z.object({
  version: z.string().optional(),
  repository: z.string().optional(),
  chart: z.string().optional(),
});

export type TerraformHelmRelease = z.infer<typeof TerraformHelmRelease>;

const TerraformWorkspace = z.object({
  terraform_version: z.string().optional(),
});

export type TerraformWorkspace = z.infer<typeof TerraformWorkspace>;

const TerraformWorkspaceArray = looseOneOrMany(TerraformWorkspace);

const DockerSimpleInstance = z.record(z.string(), tfLiteral);
const DockerTaskSpec = z
  .object({
    container_spec: oneOrMany(DockerSimpleInstance).optional(),
  })
  .catchall(tfLiteral);
const DockerPortsSpec = z.record(z.string(), tfLiteral);
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

const GenericResourceInstance = z.record(z.string(), tfLiteral);
const GenericResource = LooseRecord(
  z.string(),
  looseOneOrMany(GenericResourceInstance),
);

const KubernetesInstance = tfLiteral.transform((orig) => {
  const n = normalize(orig);
  return isArray(n) ? n : [n];
});

const TerraformResources = z
  .object({
    helm_release: LooseRecord(
      z.string(),
      looseOneOrMany(TerraformHelmRelease),
    ).optional(),
    docker_container: LooseRecord(
      z.string(),
      looseOneOrMany(DockerSimpleInstance),
    ).optional(),

    docker_image: LooseRecord(
      z.string(),
      looseOneOrMany(DockerSimpleInstance),
    ).optional(),

    docker_service: LooseRecord(
      z.string(),
      looseOneOrMany(DockerServiceInstance),
    ).optional(),
    kubernetes_cron_job_v1: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_cron_job: LooseRecord(z.string(), KubernetesInstance).optional(),
    kubernetes_daemon_set_v1: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_daemonset: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_deployment: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_deployment_v1: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_job: LooseRecord(z.string(), KubernetesInstance).optional(),
    kubernetes_job_v1: LooseRecord(z.string(), KubernetesInstance).optional(),
    kubernetes_pod: LooseRecord(z.string(), KubernetesInstance).optional(),
    kubernetes_pod_v1: LooseRecord(z.string(), KubernetesInstance).optional(),
    kubernetes_replication_controller: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_replication_controller_v1: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_stateful_set: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    kubernetes_stateful_set_v1: LooseRecord(
      z.string(),
      KubernetesInstance,
    ).optional(),
    tfe_workspace: LooseRecord(z.string(), TerraformWorkspaceArray).optional(),
  })
  .catchall(GenericResource);

export type TerraformResources = z.infer<typeof TerraformResources>;

export const TerraformDefinitionFile = z.object({
  terraform: oneOrMany(TerraformBlock).optional(),

  module: LooseRecord(z.string(), looseOneOrMany(TerraformModule)).optional(),

  resource: TerraformResources.optional(),

  data: z.record(z.string(), tfLiteral).optional(),

  provider: z.record(z.string(), oneOrMany(TerraformProvider)).optional(),
});

export type TerraformDefinitionFile = z.infer<typeof TerraformDefinitionFile>;
