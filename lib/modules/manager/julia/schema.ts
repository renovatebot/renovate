import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
  Toml,
} from '../../../util/schema-utils/index.ts';

export const JuliaProject = Toml.pipe(
  z.object({
    version: z.string().optional().catch(undefined),
    deps: LooseRecord(z.string()).optional().catch(undefined),
    weakdeps: LooseRecord(z.string()).optional().catch(undefined),
    extras: LooseRecord(z.string()).optional().catch(undefined),
    compat: LooseRecord(z.string()).optional().catch(undefined),
    targets: LooseRecord(LooseArray(z.string())).optional().catch(undefined),
    sources: LooseRecord(
      z.object({ url: z.string().optional(), path: z.string().optional() }),
    )
      .optional()
      .catch(undefined),
  }),
);
