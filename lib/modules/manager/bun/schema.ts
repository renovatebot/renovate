import { isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';

/**
 * A registry is either the URL as a string, or an object which pairs the URL
 * with credentials. Only the URL is of interest to us.
 *
 * @see https://bun.com/docs/pm/scopes-registries
 */
const BunfigRegistry = z
  .union([z.string(), z.object({ url: z.string() })])
  .transform((val) => (isString(val) ? val : val.url));

export const BunfigConfig = Toml.pipe(
  z.object({
    install: z
      .object({
        registry: BunfigRegistry.optional(),
        scopes: z.record(z.string(), BunfigRegistry).optional(),
      })
      .optional(),
  }),
);
export type BunfigConfig = z.infer<typeof BunfigConfig>;
