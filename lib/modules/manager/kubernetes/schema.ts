import { z } from 'zod/v4';
import { LooseArray, multidocYaml } from '../../../util/schema-utils/index.ts';

const PodSpecVolumes = z.object({
  volumes: LooseArray(z.object({ image: z.object({ reference: z.string() }) }))
    .transform((volumes) => volumes.map((v) => v.image.reference))
    .catch([]),
});

const TemplateSpecVolumes = z.object({
  template: z.object({ spec: PodSpecVolumes }),
});

/**
 * Reads the `app.kubernetes.io/version` value from a `metadata` object.
 * Other labels are ignored, so values of any type never invalidate a manifest.
 */
const AppVersionLabel = z
  .object({
    labels: z.object({ 'app.kubernetes.io/version': z.string() }),
  })
  .transform(
    ({ labels }): string | undefined => labels['app.kubernetes.io/version'],
  )
  .catch(undefined);

const ContainerImages = LooseArray(z.object({ image: z.string() }))
  .transform((containers) => containers.map(({ image }) => image))
  .catch([]);

const PodSpecImages = z
  .object({ containers: ContainerImages, initContainers: ContainerImages })
  .transform(({ containers, initContainers }) => [
    ...initContainers,
    ...containers,
  ]);

const PodTemplate = z
  .object({ metadata: AppVersionLabel, spec: PodSpecImages })
  .transform(({ metadata, spec }) => ({
    versionLabel: metadata,
    images: spec,
  }));

interface PodTemplateInfo {
  versionLabel: string | undefined;
  images: string[];
}

const WorkloadPodTemplate = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('Pod'),
      spec: PodSpecImages.transform((images): PodTemplateInfo => ({
        versionLabel: undefined,
        images,
      })),
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
      spec: z
        .object({ template: PodTemplate })
        .transform(({ template }): PodTemplateInfo => template),
    }),
    z.object({
      kind: z.literal('CronJob'),
      spec: z
        .object({
          jobTemplate: z.object({ spec: z.object({ template: PodTemplate }) }),
        })
        .transform(
          ({ jobTemplate }): PodTemplateInfo => jobTemplate.spec.template,
        ),
    }),
  ])
  .transform(({ spec }) => spec)
  .catch({ versionLabel: undefined, images: [] });

const ImageVolumeReferences = z
  .discriminatedUnion('kind', [
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
  ])
  .transform(({ spec }) => spec)
  .catch([]);

export const KubernetesResource = z.object({
  apiVersion: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
});

export const KubernetesManifest = KubernetesResource.extend({
  metadata: KubernetesResource.shape.metadata.extend({
    labels: z.unknown().optional(),
  }),
  spec: z.unknown().optional(),
}).transform(({ spec, metadata: { labels, ...metadata }, ...resource }) => {
  const podTemplate = WorkloadPodTemplate.parse({ kind: resource.kind, spec });
  return {
    ...resource,
    metadata,
    versionLabels: [
      AppVersionLabel.parse({ labels }),
      podTemplate.versionLabel,
    ].filter((label): label is string => !!label),
    containerImages: podTemplate.images,
    imageVolumeReferences: ImageVolumeReferences.parse({
      kind: resource.kind,
      spec,
    }),
  };
});
export type KubernetesManifest = z.infer<typeof KubernetesManifest>;

export const KubernetesManifests = multidocYaml({
  removeTemplates: true,
}).pipe(LooseArray(KubernetesManifest));
