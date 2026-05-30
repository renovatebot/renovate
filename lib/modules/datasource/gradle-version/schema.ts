import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const GradleReleaseSchema = z.object({
  buildTime: z.string().optional(),
  broken: z.boolean().optional(),
  milestoneFor: z.string().optional(),
  nightly: z.boolean().optional(),
  rcFor: z.string().optional(),
  snapshot: z.boolean().optional(),
  version: z.string(),
});

export const GradleReleasesSchema = LooseArray(GradleReleaseSchema);

export type GradleRelease = z.infer<typeof GradleReleaseSchema>;
