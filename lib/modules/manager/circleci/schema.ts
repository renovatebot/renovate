import { z } from 'zod';

export const CircleCiDocker = z.object({
  image: z.string(),
});

export type CircleCiJob = z.infer<typeof CircleCiJob>;
export const CircleCiJob = z.object({
  docker: z.array(CircleCiDocker).optional(),
});

export const CircleCiFile = z.object({
  aliases: z.array(CircleCiDocker).optional(),
  executors: z.record(z.string(), CircleCiJob).optional(),
  jobs: z.record(z.string(), CircleCiJob).optional(),
  orbs: z.record(z.string()).optional(),
});
