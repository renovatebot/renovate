import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

export const GleamToml = Toml.pipe(
  z.object({
    name: z.string(),
    dependencies: z.record(z.string(), z.string()).optional(),
    ['dev-dependencies']: z.record(z.string(), z.string()).optional(),
  }),
);

export type GleamToml = z.infer<typeof GleamToml>;
