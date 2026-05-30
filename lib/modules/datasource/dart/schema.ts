import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

const DartVersionEntrySchema = z.object({
  version: z.string(),
  published: z.string().optional().nullable(),
  retracted: z.boolean().optional().nullable(),
});

const DartLatestSchema = z.object({
  pubspec: z
    .object({
      homepage: z.string().optional().nullable(),
      repository: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const DartResultSchema = z.object({
  versions: LooseArray(DartVersionEntrySchema).optional(),
  latest: DartLatestSchema.optional().nullable(),
});

export type DartResult = z.infer<typeof DartResultSchema>;
