import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const GradleReleaseSchema = z.object({
  buildTime: z.string().optional().nullable(),
  broken: z.boolean().optional().nullable(),
  milestoneFor: z.string().optional().nullable(),
  nightly: z.boolean().optional().nullable(),
  rcFor: z.string().optional().nullable(),
  snapshot: z.boolean().optional().nullable(),
  version: z.string(),
});

export const GradleReleasesSchema = LooseArray(GradleReleaseSchema);

export type GradleRelease = z.infer<typeof GradleReleaseSchema>;
