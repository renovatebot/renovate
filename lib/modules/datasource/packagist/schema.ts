import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { looseObject, looseRecord, looseValue } from '../../../util/schema';
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
    looseObject({
      homepage: z.string(),
      source: z.object({ url: z.string() }),
      time: z.string(),
      require: z.object({ php: z.string() }),
    })
  );
export type ComposerRelease = z.infer<typeof ComposerRelease>;

export const ComposerReleases = z
  .union([
    z
      .record(looseValue(ComposerRelease))
      .transform((map) => Object.values(map)),
    z.array(looseValue(ComposerRelease)),
  ])
  .catch([])
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
    const array = MinifiedArray.parse(packages[packageName]);
    const releases = ComposerReleases.parse(array);
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
  ...composerReleasesArrays: ComposerReleases[]
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

export function extractDepReleases(
  composerReleases: unknown
): ReleaseResult | null {
  const parsedReleases = ComposerReleases.parse(composerReleases);
  return extractReleaseResult(parsedReleases);
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

export const RegistryFile = z.object({
  key: z.string(),
  sha256: z.string(),
});
export type RegistryFile = z.infer<typeof RegistryFile>;

export const PackagesResponse = z.object({
  packages: looseRecord(ComposerReleases),
});
export type PackagesResponse = z.infer<typeof PackagesResponse>;

export const PackagistFile = PackagesResponse.merge(
  z.object({
    providers: looseRecord(
      z.object({
        sha256: looseValue(z.string()),
      })
    ).transform((x) =>
      Object.fromEntries(
        Object.entries(x).map(([key, { sha256 }]) => [key, sha256])
      )
    ),
  })
);
export type PackagistFile = z.infer<typeof PackagistFile>;

export const RegistryMeta = z
  .preprocess(
    (x) => (is.plainObject(x) ? x : {}),
    PackagistFile.merge(
      z.object({
        ['includes']: looseRecord(
          z.object({
            sha256: z.string(),
          })
        ).transform((x) =>
          Object.entries(x).map(([name, { sha256 }]) => ({
            key: name.replace(sha256, '%hash%'),
            sha256,
          }))
        ),
        ['provider-includes']: looseRecord(
          z.object({
            sha256: z.string(),
          })
        ).transform((x) =>
          Object.entries(x).map(([key, { sha256 }]) => ({ key, sha256 }))
        ),
        ['providers-lazy-url']: looseValue(z.string()),
        ['providers-url']: looseValue(z.string()),
      })
    )
  )
  .transform(
    ({
      ['includes']: includesFiles,
      ['packages']: packages,
      ['provider-includes']: files,
      ['providers']: providerPackages,
      ['providers-lazy-url']: providersLazyUrl,
      ['providers-url']: providersUrl,
    }) => ({
      packages,
      includesFiles,
      providerPackages,
      files,
      providersUrl,
      providersLazyUrl,
      includesPackages: {} as Record<string, ReleaseResult | null>,
    })
  );
export type RegistryMeta = z.infer<typeof RegistryMeta>;
