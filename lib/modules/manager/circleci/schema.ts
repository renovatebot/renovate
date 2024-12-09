import { z } from 'zod';

export const CircleCiDocker = z.object({
  image: z.string(),
});

export const CircleCiJob = z.object({
  docker: z.array(CircleCiDocker).optional(),
});
export type CircleCiJob = z.infer<typeof CircleCiJob>;

type Orb = {
  executors?: Record<string, CircleCiJob>;
  jobs?: Record<string, CircleCiJob>;
  orbs?: Record<string, string | Orb>;
};

export const CircleCiOrb: z.ZodType<Orb> = z.object({
  executors: z.record(z.string(), CircleCiJob).optional(),
  jobs: z.record(z.string(), CircleCiJob).optional(),
  orbs: z.lazy(() =>
    z.record(z.string(), z.union([z.string(), CircleCiOrb])).optional(),
  ),
});
export type CircleCiOrb = z.infer<typeof CircleCiOrb>;

export const CircleCiFile = z.object({
  aliases: z.array(CircleCiDocker).optional(),
  executors: z.record(z.string(), CircleCiJob).optional(),
  jobs: z.record(z.string(), CircleCiJob).optional(),
  orbs: z.record(z.string(), z.union([z.string(), CircleCiOrb])).optional(),
});
export type CircleCiFile = z.infer<typeof CircleCiFile>;
