import { z } from 'zod/v3';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { ReleaseResult } from '../types.ts';

/**
 * Response from package.elm-lang.org/packages/{author}/{package}/releases.json
 * Maps version strings to Unix timestamps
 */
export const ElmPackageReleasesSchema = z
  .record(z.string(), z.number())
  .refine((obj) => Object.keys(obj).length > 0, 'No releases found')
  .transform((releases): ReleaseResult => {
    return {
      releases: Object.entries(releases).map(([version, timestamp]) => ({
        version,
        releaseTimestamp: asTimestamp(timestamp),
      })),
    };
  });

export type ElmPackageReleases = Record<string, number>;
