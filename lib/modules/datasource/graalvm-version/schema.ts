import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import type { Release } from '../types';

// Schema for individual release from mise-java API
const MiseJavaReleaseSchema = z.object({
  checksum: z.string().nullable(),
  created_at: z.string(),
  features: z.array(z.string()),
  file_type: z.string(),
  image_type: z.string(),
  java_version: z.string(),
  jvm_impl: z.string(),
  url: z.string().url(),
  vendor: z.string(),
  version: z.string(),
});

// Transform to Renovate Release format
export const GraalVmReleases = LooseArray(MiseJavaReleaseSchema).transform(
  (releases): Release[] => {
    return releases.map(({ version }) => ({
      version,
    }));
  },
);
