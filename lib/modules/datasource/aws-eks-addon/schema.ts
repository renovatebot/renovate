import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const EksAddonsFilterSchema = z.object({
  kubernetesVersion: z.string().min(1),
  addonName: z.string().min(1),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export type EksAddonsFilter = z.infer<typeof EKSAddonsFilterSchema>;
export const EksAddonsFilter = Json.pipe(EksAddonsFilterSchema);
