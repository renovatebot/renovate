import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const EksAddonsFilterSchema = z.object({
  addonName: z.string().min(1),
  kubernetesVersion: z.string().optional(),
  default: z.boolean().optional(),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export type EksAddonsFilter = z.infer<typeof EksAddonsFilterSchema>;
export const EksAddonsFilter = Json.pipe(EksAddonsFilterSchema);
