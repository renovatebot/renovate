import { z } from 'zod/v4';
import { LooseArray, Nullish } from '../../../util/schema-utils/index.ts';

export const CondaFile = z.object({
  version: z.string(),
  upload_time: Nullish(z.string()),
});

export const CondaPackage = z.object({
  html_url: Nullish(z.string()),
  dev_url: Nullish(z.string()),
  files: LooseArray(CondaFile).optional(),
  versions: z.array(z.string()).optional(),
});

export type CondaPackage = z.infer<typeof CondaPackage>;
