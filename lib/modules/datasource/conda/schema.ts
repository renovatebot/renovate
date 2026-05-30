import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const CondaFileSchema = z.object({
  version: z.string(),
  upload_time: z.string().optional(),
});

export const CondaPackageSchema = z.object({
  html_url: z.string().optional(),
  dev_url: z.string().optional(),
  files: LooseArray(CondaFileSchema).optional(),
  versions: z.array(z.string()).optional(),
});

export type CondaPackageSchema = z.infer<typeof CondaPackageSchema>;
