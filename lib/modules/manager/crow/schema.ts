import { z } from 'zod';

export const crowStep = z.object({
  image: z.string().optional(),
});

export const crowConfig = z.object({
  pipeline: z.record(z.string(), crowStep).optional(),
  steps: z.record(z.string(), crowStep).optional(),
  clone: z.record(z.string(), crowStep).optional(),
  services: z.record(z.string(), crowStep).optional(),
});

export type CrowConfigDefinition = z.infer<typeof crowConfig>;
export type CrowStepDefinition = z.infer<typeof crowStep>;
