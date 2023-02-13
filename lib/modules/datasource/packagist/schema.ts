import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import type { Release, ReleaseResult } from '../types';

export const MinifiedArray = z.array(z.record(z.unknown())).transform((xs) => {
  // Ported from: https://github.com/composer/metadata-minifier/blob/main/src/MetadataMinifier.php#L17
  if (xs.length === 0) {
    return xs;
  }

  const prevVals: Record<string, unknown> = {};
  for (const x of xs) {
    for (const key of Object.keys(x)) {
      prevVals[key] ??= undefined;
    }

    for (const key of Object.keys(prevVals)) {
      const val = x[key];
      if (val === '__unset') {
        delete x[key];
        prevVals[key] = undefined;
        continue;
      }

      if (!is.undefined(val)) {
        prevVals[key] = val;
        continue;
      }

      if (!is.undefined(prevVals[key])) {
        x[key] = prevVals[key];
        continue;
      }
    }
  }

  return xs;
});
export type MinifiedArray = z.infer<typeof MinifiedArray>;

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
        require: z
          .object({
            php: z.string(),
          })
          .nullable()
          .catch(null),
      })
      .partial()
  );
export type ComposerRelease = z.infer<typeof ComposerRelease>;

export const ComposerReleasesArray = z
  .array(ComposerRelease.nullable().catch(null))
  .transform((xs) => xs.filter((x): x is ComposerRelease => x !== null));
export type ComposerReleasesArray = z.infer<typeof ComposerReleasesArray>;

export const ComposerReleasesRecord = z
  .record(ComposerRelease.nullable().catch(null))
  .transform((map) => {
    const res: Record<string, ComposerRelease> = {};
    for (const [key, value] of Object.entries(map)) {
      if (value !== null && value.version === key) {
        res[key] = value;
      }
    }
    return res;
  });
export type ComposerReleasesRecord = z.infer<typeof ComposerReleasesRecord>;

export const ComposerPackagesResponse = z.object({
  packages: z.record(z.unknown()),
});

export function parsePackagesResponse(
  packageName: string,
  packagesResponse: unknown
): ComposerReleasesArray {
  try {
    const { packages } = ComposerPackagesResponse.parse(packagesResponse);
    const array = MinifiedArray.parse(packages[packageName]);
    const releases = ComposerReleasesArray.parse(array);
    return releases;
  } catch (err) {
    logger.debug(
      { packageName, err },
      `Error parsing packagist response for ${packageName}`
    );
    return [];
  }
}

export function extractReleaseResult(
  ...composerReleasesArrays: ComposerReleasesArray[]
): ReleaseResult | null {
  const releases: Release[] = [];
  let homepage: string | null | undefined;
  let sourceUrl: string | null | undefined;

  for (const composerReleasesArray of composerReleasesArrays) {
    for (const composerRelease of composerReleasesArray) {
      const version = composerRelease.version.replace(/^v/, '');
      const gitRef = composerRelease.version;

      const dep: Release = { version, gitRef };

      if (composerRelease.time) {
        dep.releaseTimestamp = composerRelease.time;
      }

      if (composerRelease.require?.php) {
        dep.constraints = { php: [composerRelease.require.php] };
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

export function parsePackagesResponses(
  packageName: string,
  packagesResponses: unknown[]
): ReleaseResult | null {
  const releaseArrays = packagesResponses.map((pkgResp) =>
    parsePackagesResponse(packageName, pkgResp)
  );
  return extractReleaseResult(...releaseArrays);
}
