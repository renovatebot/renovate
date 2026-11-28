import { z } from 'zod/v4';
import { Json, LooseArray } from '../../../util/schema-utils/index.ts';

export const PuppetModuleMetadata = Json.pipe(
  z.object({
    dependencies: LooseArray(
      z.object({
        name: z.string(),
        version_requirement: z.string().optional(),
      }),
    ).default([]),
  }),
);
