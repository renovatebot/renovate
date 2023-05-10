import { z } from 'zod';
import type { Release } from '../types';

const EndoflifeDateVersionScheme = z
  .object({
    cycle: z.string(),
    releaseDate: z.optional(z.string()),
    eol: z.optional(z.union([z.string(), z.boolean()])),
    latest: z.optional(z.string()),
    link: z.optional(z.string()),
    lts: z.optional(z.union([z.string(), z.boolean()])),
    support: z.optional(z.union([z.string(), z.boolean()])),
    discontinued: z.optional(z.union([z.string(), z.boolean()])),
  })
  .transform(({ cycle, releaseDate }): Release => {
    return {
      version: cycle,
      releaseTimestamp: releaseDate,
    };
  });

export const EndoflifeHttpResponseScheme = z.array(EndoflifeDateVersionScheme);
