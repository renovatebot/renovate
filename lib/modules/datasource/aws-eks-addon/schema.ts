import { z } from 'zod';

export const EksAddonsFilterSchema = z.object({
  kubernetesVersion: z.string().min(1),
  addonName: z.string().min(1),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export type EksAddonsFilter = z.infer<typeof EKSAddonsFilterSchema>;
export EksAddonsFilterJson = Json.pipe(EksAddonsFilterSchema);
