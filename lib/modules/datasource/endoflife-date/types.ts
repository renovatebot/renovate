import { z } from 'zod';
import type { Release } from '../types';

// represents a "cycle" on endoflife.date
export interface EndoflifeDateVersion {
  cycle: string | number;
  releaseDate?: string;
  eol?: string | boolean;
  latest?: string;
  link?: string | null;
  lts?: string | boolean;
  support?: string | boolean;
  discontinued?: string | boolean;
}

export const EndoflifeDateVersion = z
  .object({
    cycle: z.coerce.string(),
    releaseDate: z.optional(z.string()),
    eol: z.optional(z.union([z.string(), z.boolean()])),
    latest: z.optional(z.string()),
    link: z.optional(z.string()),
    lts: z.optional(z.union([z.string(), z.boolean()])),
    support: z.optional(z.union([z.string(), z.boolean()])),
    discontinued: z.optional(z.union([z.string(), z.boolean()])),
  })
  .transform(({ cycle, releaseDate }): Release[] => [
    {
      version: cycle,
      releaseTimestamp: releaseDate,
    },
  ]);
