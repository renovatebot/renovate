import { z } from 'zod';

// TODO Full schema
const PipfileLockEntrySchema = z
  .record(
    z.string(),
    z.object({
      version: z.string().optional(),
    })
  )
  .optional();
export const PipfileLockSchema = z.object({
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
});
