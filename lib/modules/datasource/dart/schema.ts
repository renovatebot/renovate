import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

const DartVersionEntrySchema = z.object({
  version: z.string(),
  published: z.string().optional(),
  retracted: z.boolean().optional(),
});

const DartLatestSchema = z.object({
  pubspec: z
    .object({
      homepage: z.string().optional(),
      repository: z.string().optional(),
    })
    .optional(),
});

export const DartResultSchema = z.object({
  versions: LooseArray(DartVersionEntrySchema).optional(),
  latest: DartLatestSchema.optional(),
});

export type DartResult = z.infer<typeof DartResultSchema>;
