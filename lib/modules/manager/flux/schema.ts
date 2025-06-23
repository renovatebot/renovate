import { z } from 'zod';

export const KubernetesResource = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  metadata: z.object({
    name: z.string(),
    // For Flux, the namespace property is optional, but matching HelmReleases to HelmRepositories would be
    // much more difficult without it (we'd have to examine the parent Kustomizations to discover the value),
    // so we require it for renovation.
    namespace: z.string().optional(),
  }),
});

export const HelmRelease = KubernetesResource.extend({
  apiVersion: z.string().startsWith('helm.toolkit.fluxcd.io/'),
  kind: z.literal('HelmRelease'),
  spec: z.object({
    chart: z
      .object({
        spec: z.object({
          chart: z.string(),
          version: z.string().optional(),
          sourceRef: z
            .object({
              kind: z.string().optional(),
              name: z.string().optional(),
              namespace: z.string().optional(),
            })
            .optional(),
        }),
      })
      .optional(),
    chartRef: z
      .object({
        kind: z.string().optional(),
        name: z.string().optional(),
        namespace: z.string().optional(),
      })
      .optional(),
    values: z.record(z.unknown()).optional(),
  }),
});
export type HelmRelease = z.infer<typeof HelmRelease>;

export const HelmRepository = KubernetesResource.extend({
  apiVersion: z.string().startsWith('source.toolkit.fluxcd.io/'),
  kind: z.literal('HelmRepository'),
  spec: z.object({
    url: z.string(),
    type: z.enum(['oci', 'default']).optional(),
  }),
});
export type HelmRepository = z.infer<typeof HelmRepository>;

export const HelmChart = KubernetesResource.extend({
  apiVersion: z.string().startsWith('source.toolkit.fluxcd.io/'),
  kind: z.literal('HelmChart'),
  spec: z.object({
    chart: z.string(),
    version: z.string().optional(),
    sourceRef: z.object({
      kind: z.string().optional(),
      name: z.string().optional(),
    }),
  }),
});
export type HelmChart = z.infer<typeof HelmChart>;

export const GitRepository = KubernetesResource.extend({
  apiVersion: z.string().startsWith('source.toolkit.fluxcd.io/'),
  kind: z.literal('GitRepository'),
  spec: z.object({
    url: z.string(),
    ref: z
      .object({
        tag: z.string().optional(),
        commit: z.string().optional(),
      })
      .optional(),
  }),
});

export const OCIRepository = KubernetesResource.extend({
  apiVersion: z.string().startsWith('source.toolkit.fluxcd.io/'),
  kind: z.literal('OCIRepository'),
  spec: z.object({
    url: z.string(),
    ref: z
      .object({
        tag: z.string().optional(),
        digest: z.string().optional(),
      })
      .optional(),
  }),
});

export const Kustomization = KubernetesResource.extend({
  apiVersion: z.string().startsWith('kustomize.toolkit.fluxcd.io/'),
  kind: z.literal('Kustomization'),
  spec: z.object({
    images: z
      .array(
        z.object({
          name: z.string(),
          newName: z.string().optional(),
          newTag: z.string().optional(),
          digest: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const FluxResource = HelmRelease.or(HelmRepository)
  .or(HelmChart)
  .or(GitRepository)
  .or(OCIRepository)
  .or(Kustomization);
export type FluxResource = z.infer<typeof FluxResource>;
