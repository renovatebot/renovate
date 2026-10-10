import { z } from 'zod/v4';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

export const GitlabPackage = DeepNullish(
  z.object({
    version: z.string(),
    created_at: z.string(),
    name: z.string(),
    conan_package_name: z.string().optional(),
  }),
).transform(
  ({
    version,
    created_at,
    name,
    conan_package_name,
  }): { packageName: string; release: Release } => ({
    packageName: conan_package_name ?? name,
    release: { version, releaseTimestamp: asTimestamp(created_at) },
  }),
);
export type GitlabPackage = z.infer<typeof GitlabPackage>;

export const GitlabPackages = LooseArray(GitlabPackage);
