import { z } from 'zod';
import { api as versioning } from '../../versioning/composer';
import type { Release, ReleaseResult } from '../types';

export const PackageName = z
  .string()
  .refine((s) => s.split('/').length === 2, 'Invalid package name');

export const ComposerV2Release = z.object({
  version: z.string(),
  homepage: z.optional(z.string().url()),
  source: z.optional(
    z.object({
      url: z.string().url(),
    })
  ),
  time: z.string().datetime({ offset: true }),
});

export const ComposerV2PackageResponse = z.object({
  packages: z.record(PackageName, z.array(ComposerV2Release)),
});

export const ComposerV2ReleaseResult = z
  .array(ComposerV2PackageResponse)
  .transform((responses): ReleaseResult => {
    const releases: Release[] = [];
    let maxVersion: string | undefined;
    let homepage: string | undefined = undefined;
    let sourceUrl: string | undefined = undefined;

    for (const response of responses) {
      for (const responsePackage of Object.values(response.packages)) {
        for (const composerV2Release of responsePackage) {
          const { version, time: releaseTimestamp } = composerV2Release;
          const dep: Release = {
            version: version.replace(/^v/, ''),
            gitRef: version,
            releaseTimestamp,
          };
          releases.push(dep);

          if (!versioning.isValid(version)) {
            continue;
          }

          if (!maxVersion || versioning.isGreaterThan(version, maxVersion)) {
            maxVersion = version;
            homepage = composerV2Release.homepage;
            sourceUrl = composerV2Release.source?.url;
          }
        }
      }
    }

    const result: ReleaseResult = { releases };

    if (homepage) {
      result.homepage = homepage;
    }

    if (sourceUrl) {
      result.sourceUrl = sourceUrl;
    }

    return result;
  });
