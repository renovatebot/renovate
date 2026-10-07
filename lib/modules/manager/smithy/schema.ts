import { z } from 'zod/v4';
import { Jsonc, LooseArray } from '../../../util/schema-utils/index.ts';

export const SmithyBuild = Jsonc.pipe(
  z.object({
    maven: z
      .object({
        dependencies: LooseArray(z.string()).optional(),
        repositories: LooseArray(z.object({ url: z.string() })).optional(),
      })
      .optional(),
  }),
);

export type SmithyBuild = z.infer<typeof SmithyBuild>;
