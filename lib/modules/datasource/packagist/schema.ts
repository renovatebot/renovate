import { z } from 'zod';
import { api as versioning } from '../../versioning/composer';
import type { Release, ReleaseResult } from '../types';

export const ComposerRelease = z.object({
  version: z
    .string()
    .refine((v) => versioning.isSingleVersion(v), 'Invalid version'),
  homepage: z.string().url().nullable().catch(null),
  source: z
    .object({
      url: z.string(),
    })
    .transform((x) => x.url)
    .nullable()
    .catch(null),
  time: z.string().nullable().catch(null),
});

export const ComposerReleaseArray = z
  .array(ComposerRelease.nullable().catch(null))
  .transform((xs) =>
    xs.filter((x): x is z.infer<typeof ComposerRelease> => x !== null)
  );
export type ComposerReleaseArray = z.infer<typeof ComposerReleaseArray>;

export const ComposerPackagesResponse = z.object({
  packages: z.record(z.unknown()),
});

export function parsePackagesResponse(
  packageName: string,
  packagesResponse: unknown
): ComposerReleaseArray {
  const packagesResponseParsed =
    ComposerPackagesResponse.safeParse(packagesResponse);
  if (!packagesResponseParsed.success) {
    return [];
  }

  const { packages } = packagesResponseParsed.data;
  const releaseArray = packages[packageName];
  const releaseArrayParsed = ComposerReleaseArray.safeParse(releaseArray);
  if (!releaseArrayParsed.success) {
    return [];
  }

  return releaseArrayParsed.data;
}

export function parsePackagesResponses(
  packageName: string,
  packagesResponses: unknown[]
): ReleaseResult | null {
  const releases: Release[] = [];
  let maxVersion: string | null = null;
  let homepage: string | null = null;
  let sourceUrl: string | null = null;

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

      if (!maxVersion || versioning.isGreaterThan(version, maxVersion)) {
        maxVersion = version;
        homepage = composerRelease.homepage;
        sourceUrl = composerRelease.source;
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
