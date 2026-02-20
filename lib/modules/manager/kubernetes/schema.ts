import { z } from 'zod/v3';

export const KubernetesResource = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
});
