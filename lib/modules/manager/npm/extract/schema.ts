import { z } from 'zod';
import { LooseRecord } from '../../../../util/schema-utils';

export const PackageLockV3Schema = z.object({
  lockfileVersion: z.literal(3),
  packages: LooseRecord(
    z
      .string()
      .transform((x) => x.replace(/^node_modules\//, ''))
      .refine((x) => x.trim() !== ''),
    z.object({ version: z.string() })
  ),
});

export const PackageLockPreV3Schema = z.object({
  lockfileVersion: z.union([z.literal(2), z.literal(1)]),
  dependencies: z
    .record(z.string(), z.object({ version: z.string() }))
    .catch({}),
});
