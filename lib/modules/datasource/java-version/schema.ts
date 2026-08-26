import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const AdoptiumJavaVersion = z.object({
  semver: z.string(),
});

export const AdoptiumJavaResponse = z.object({
  versions: LooseArray(AdoptiumJavaVersion).optional(),
});

export type AdoptiumJavaResponse = z.infer<typeof AdoptiumJavaResponse>;

export const AdoptiumAvailableReleases = z.object({
  available_lts_releases: z.array(z.number()),
});

export type AdoptiumAvailableReleases = z.infer<
  typeof AdoptiumAvailableReleases
>;
