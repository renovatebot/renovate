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

export type CrowConfigDefinition = z.infer<typeof crowConfig>;
export type CrowStepDefinition = z.infer<typeof crowStep>;
