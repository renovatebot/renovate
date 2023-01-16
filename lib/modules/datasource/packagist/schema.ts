import { z } from 'zod';
import { logger } from '../../../logger';
import type { Release, ReleaseResult } from '../types';

export const ComposerRelease = z
  .object({
    version: z.string(),
  })
  .merge(
    z
      .object({
        homepage: z.string().nullable().catch(null),
        source: z
          .object({
            url: z.string(),
          })
          .nullable()
          .catch(null),
        time: z.string().nullable().catch(null),
      })
      .partial()
  );
export type ComposerRelease = z.infer<typeof ComposerRelease>;

export const ComposerReleases = z
  .array(ComposerRelease.nullable().catch(null))
  .transform((xs) => xs.filter((x): x is ComposerRelease => x !== null));
export type ComposerReleases = z.infer<typeof ComposerReleases>;

export const ComposerPackagesResponse = z.object({
  packages: z.record(z.unknown()),
});

export function parsePackagesResponse(
  packageName: string,
  packagesResponse: unknown
): ComposerReleases {
  try {
    const { packages } = ComposerPackagesResponse.parse(packagesResponse);
    const releases = ComposerReleases.parse(packages[packageName]);
    return releases;
  } catch (err) {
    logger.debug(
      { packageName, err },
      `Error parsing packagist response for ${packageName}`
    );
    return [];
  }
}

export function parsePackagesResponses(
  packageName: string,
  packagesResponses: unknown[]
): ReleaseResult | null {
  const releases: Release[] = [];
  let homepage: string | null | undefined;
  let sourceUrl: string | null | undefined;

  for (const packagesResponse of packagesResponses) {
    const releaseArray = parsePackagesResponse(packageName, packagesResponse);
    for (const composerRelease of releaseArray) {
      const version = composerRelease.version.replace(/^v/, '');
      const gitRef = composerRelease.version;

      const dep: Release = { version, gitRef };

      if (composerRelease.time) {
        dep.releaseTimestamp = composerRelease.time;
      }

      releases.push(dep);

      if (!homepage && composerRelease.homepage) {
        homepage = composerRelease.homepage;
      }

      if (!sourceUrl && composerRelease.source?.url) {
        sourceUrl = composerRelease.source.url;
      }
    }
  }

  if (releases.length === 0) {
    return null;
  }

  const result: ReleaseResult = { releases };

  if (homepage) {
    result.homepage = homepage;
  }

  if (sourceUrl) {
    result.sourceUrl = sourceUrl;
  }

  return result;
}
