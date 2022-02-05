import { z } from 'zod';
import type { DartResult as DartResultDeprecated } from './types';

/**
 * @see https://github.com/dart-lang/pub/blob/master/doc/repository-spec-v2.md#list-all-versions-of-a-package
 */
export const DartResponseSchema = z.object({
  versions: z.object({
    version: z.string(),
    retracted: z.boolean().optional(),
    published: z.boolean().optional(),
  }),
  latest: z
    .object({
      pubspec: z
        .object({
          homepage: z.string().url().optional(),
          repository: z.string().url().optional(),
        })
        .optional(),
    })
    .optional(),
});

// export type DartResponse = z.infer<typeof DartResponseSchema>;
export type DartResponse = DartResultDeprecated;
