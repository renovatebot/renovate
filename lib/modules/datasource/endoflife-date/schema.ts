import { DateTime } from 'luxon';
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
  .transform(({ cycle, releaseDate, eol, discontinued }): Release => {
    let isDeprecated = false;

    // If "eol" date or "discontinued" date has passed or any of the values is explicitly true, set to deprecated
    // "support" is not checked because support periods sometimes end before the EOL.
    if (
      eol === true ||
      discontinued === true ||
      (typeof eol === 'string' &&
        DateTime.fromISO(eol, { zone: 'UTC' }) <= DateTime.now()) ||
      (typeof discontinued === 'string' &&
        DateTime.fromISO(discontinued, { zone: 'UTC' }) <= DateTime.now())
    ) {
      isDeprecated = true;
    }

    return {
      version: cycle,
      releaseTimestamp: releaseDate,
      isDeprecated,
    };
  });

export const EndoflifeHttpResponseScheme = z.array(EndoflifeDateVersionScheme);
