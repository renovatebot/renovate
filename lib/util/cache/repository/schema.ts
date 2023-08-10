import { z } from 'zod';

export const RepoCacheV13 = z
  .object({
    repository: z.string().min(1),
    revision: z.number().refine((v) => v === 13),
    payload: z.string().min(1),
    hash: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();

export type RepoCacheRecord = z.infer<typeof RepoCacheV13>;
