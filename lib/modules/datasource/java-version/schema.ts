import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const AdoptiumJavaVersion = z.object({
  semver: z.string(),
});

export const AdoptiumJavaResponse = z.object({
  versions: LooseArray(AdoptiumJavaVersion).optional(),
});

export type AdoptiumJavaResponse = z.infer<typeof AdoptiumJavaResponse>;

export const MiseJavaRelease = z.object({
  checksum: z.string().nullable(),
  created_at: z.string(),
  features: z.array(z.string()),
  file_type: z.string(),
  image_type: z.string(),
  java_version: z.string(),
  jvm_impl: z.string(),
  url: z.string(),
  vendor: z.string(),
  version: z.string(),
});

export type MiseJavaRelease = z.infer<typeof MiseJavaRelease>;
