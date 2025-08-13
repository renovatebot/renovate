import { z } from 'zod';

export const CrowStep = z.object({
  image: z.string().optional(),
});

export const CrowConfig = z.object({
  pipeline: z.record(z.string(), CrowStep).optional(),
  steps: z.record(z.string(), CrowStep).optional(),
  clone: z.record(z.string(), CrowStep).optional(),
  services: z.record(z.string(), CrowStep).optional(),
});

export type CrowConfig = z.infer<typeof CrowConfig>;
export type CrowStep = z.infer<typeof CrowStep>;
