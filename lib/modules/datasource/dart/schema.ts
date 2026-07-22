import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

const DartVersionEntry = z.object({
  version: z.string(),
  published: z.string().optional(),
  retracted: z.boolean().optional(),
  pubspec: z
    .object({
      environment: z
        .object({
          sdk: z.string().optional(),
          flutter: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const DartLatest = z.object({
  pubspec: z
    .object({
      homepage: z.string().optional(),
      repository: z.string().optional(),
    })
    .optional(),
});

export const DartResult = z.object({
  versions: LooseArray(DartVersionEntry).optional(),
  latest: DartLatest.optional(),
});

export type DartResult = z.infer<typeof DartResult>;
