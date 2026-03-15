import { z } from 'zod/v3';
import { LooseArray, multidocYaml } from '../../../util/schema-utils/index.ts';

export const KubernetesResource = z.object({
  apiVersion: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
});

export type KubernetesManifest = z.infer<typeof KubernetesResource>;

export const KubernetesManifests = multidocYaml({
  removeTemplates: true,
}).pipe(LooseArray(KubernetesResource));
