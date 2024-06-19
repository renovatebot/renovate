import { z } from 'zod';

export const EKSAddonsFilterSchema = z.object({
  kubernetesVersion: z.string().min(1),
  addonName: z.string().min(1),
  region: z.string().optional(),
  profile: z.string().optional(),
});

export type EKSAddonsFilter = z.infer<typeof EKSAddonsFilterSchema>;
