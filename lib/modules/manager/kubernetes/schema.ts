import { z } from 'zod/v3';
import { LooseArray, multidocYaml } from '../../../util/schema-utils/index.ts';

const PodSpecVolumes = z.object({
  volumes: LooseArray(z.object({ image: z.object({ reference: z.string() }) }))
    .transform((volumes) => volumes.map((v) => v.image.reference))
    .catch([]),
});

const TemplateSpecVolumes = z.object({
  template: z.object({ spec: PodSpecVolumes }),
});

const templateSpecVolumeExtractor = TemplateSpecVolumes.transform(
  (s) => s.template.spec.volumes,
);

const cronJobVolumeExtractor = z
  .object({ jobTemplate: z.object({ spec: TemplateSpecVolumes }) })
  .transform((s) => s.jobTemplate.spec.template.spec.volumes);

const imageVolumeExtractors = new Map<
  string,
  z.ZodType<string[], z.ZodTypeDef, unknown>
>([
  ['Pod', PodSpecVolumes.transform((s) => s.volumes)],
  ['DaemonSet', templateSpecVolumeExtractor],
  ['Deployment', templateSpecVolumeExtractor],
  ['Job', templateSpecVolumeExtractor],
  ['ReplicaSet', templateSpecVolumeExtractor],
  ['ReplicationController', templateSpecVolumeExtractor],
  ['StatefulSet', templateSpecVolumeExtractor],
  ['CronJob', cronJobVolumeExtractor],
]);

export const KubernetesResource = z.object({
  apiVersion: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
});

export const KubernetesManifest = KubernetesResource.extend({
  spec: z.unknown(),
}).transform(({ spec, ...resource }) => ({
  ...resource,
  imageVolumeReferences:
    imageVolumeExtractors.get(resource.kind)?.safeParse(spec).data ?? [],
}));
export type KubernetesManifest = z.infer<typeof KubernetesManifest>;

export const KubernetesManifests = multidocYaml({
  removeTemplates: true,
}).pipe(LooseArray(KubernetesManifest));
