import { z } from 'zod/v4';
import { LooseRecord, Toml } from '../../../util/schema-utils/index.ts';

export const JuliaProject = Toml.pipe(
  z.object({
    version: z.string().optional(),
    compat: LooseRecord(z.string()).optional(),
  }),
);
