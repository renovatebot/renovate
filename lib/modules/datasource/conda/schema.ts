import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const CondaFile = z.object({
  version: z.string(),
  upload_time: z.string().optional(),
});

export const CondaPackage = z.object({
  html_url: z.string().optional(),
  dev_url: z.string().optional(),
  files: LooseArray(CondaFile).optional(),
  versions: z.array(z.string()).optional(),
});

export type CondaPackage = z.infer<typeof CondaPackage>;
