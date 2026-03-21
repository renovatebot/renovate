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

const ImageVolumeReferences = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('Pod'),
    spec: PodSpecVolumes.transform((s) => s.volumes),
  }),
  z.object({
    kind: z.enum([
      'DaemonSet',
      'Deployment',
      'Job',
      'ReplicaSet',
      'ReplicationController',
      'StatefulSet',
    ]),
    spec: TemplateSpecVolumes.transform((s) => s.template.spec.volumes),
  }),
  z.object({
    kind: z.literal('CronJob'),
    spec: z
      .object({ jobTemplate: z.object({ spec: TemplateSpecVolumes }) })
      .transform((s) => s.jobTemplate.spec.template.spec.volumes),
  }),
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
    ImageVolumeReferences.safeParse({ kind: resource.kind, spec }).data?.spec ??
    [],
}));
export type KubernetesManifest = z.infer<typeof KubernetesManifest>;

export const KubernetesManifests = multidocYaml({
  removeTemplates: true,
}).pipe(LooseArray(KubernetesManifest));
