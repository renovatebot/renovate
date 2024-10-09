import { z } from 'zod';

export const CircleCiDocker = z.object({
  image: z.string(),
});

export type CircleCiJob = z.infer<typeof CircleCiJob>;
export const CircleCiJob = z.object({
  docker: z.array(CircleCiDocker).optional(),
});

type Orb = {
  executors?: Record<string, CircleCiJob>;
  jobs?: Record<string, CircleCiJob>;
  orbs?: Record<string, string | Orb>;
};

type CircleCiJobInput = z.input<typeof CircleCiJob>;

type OrbInput = {
  executors?: Record<string, CircleCiJobInput>;
  jobs?: Record<string, CircleCiJobInput>;
  orbs?: Record<string, string | OrbInput>;
};

export type CircleCiOrb = z.infer<typeof CircleCiOrb>;
export const CircleCiOrb: z.ZodType<Orb, any, OrbInput> = z.object({
  executors: z.record(z.string(), CircleCiJob).optional(),
  jobs: z.record(z.string(), CircleCiJob).optional(),
  orbs: z.lazy(() =>
    z.record(z.string(), z.union([z.string(), CircleCiOrb])).optional(),
  ),
});

export type CircleCiFile = z.infer<typeof CircleCiFile>;
export const CircleCiFile = z.object({
  aliases: z.array(CircleCiDocker).optional(),
  executors: z.record(z.string(), CircleCiJob).optional(),
  jobs: z.record(z.string(), CircleCiJob).optional(),
  orbs: z.record(z.string(), z.union([z.string(), CircleCiOrb])).optional(),
});
