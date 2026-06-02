import { z } from 'zod';
import type { Nullish } from '../../../types/index.ts';

export interface AdoptiumJavaVersion {
  semver: string;
}

export interface AdoptiumJavaResponse {
  versions?: AdoptiumJavaVersion[];
}

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

export interface PackageConfig {
  vendor: 'adoptium' | 'oracle-graalvm';
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
  releaseType?: string;
}
