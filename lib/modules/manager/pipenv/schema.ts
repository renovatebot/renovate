import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

const PipfileLockEntrySchema = z
  .record(
    z.string(),
    z.object({
      version: z.string().optional(),
    }),
  )
  .optional();

export const PipfileLockSchema = Json.pipe(
  z.object({
    _meta: z
      .object({
        requires: z
          .object({
            python_version: z.string().optional(),
            python_full_version: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    default: PipfileLockEntrySchema,
    develop: PipfileLockEntrySchema,
  }),
);
