import { z } from 'zod/v4';
import { LooseRecord, Toml } from '../../../util/schema-utils/index.ts';
import type { Release } from '../types.ts';

export const Registry = Toml.pipe(
  z.object({
    packages: LooseRecord(
      z.string(),
      z.object({ name: z.string(), path: z.string() }),
    ),
  }),
);
export type Registry = z.infer<typeof Registry>;

export const Package = Toml.pipe(z.object({ repo: z.string().optional() }));

export const Versions = Toml.pipe(
  LooseRecord(z.string(), z.object({ yanked: z.boolean().optional() })),
).transform((versions): Release[] =>
  Object.entries(versions).map(([version, info]): Release => {
    const release: Release = { version };
    if (info.yanked) {
      release.isDeprecated = true;
    }
    return release;
  }),
);
