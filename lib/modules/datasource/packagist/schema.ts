import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import {
  looseArray,
  looseObject,
  looseRecord,
  looseValue,
} from '../../../util/schema';
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

const ComposerReleasesLooseArray = looseArray(ComposerRelease);
type ComposerReleasesLooseArray = z.infer<typeof ComposerReleasesLooseArray>;

export const ComposerReleases = z
  .union([
    MinifiedArray.transform((xs) => ComposerReleasesLooseArray.parse(xs)),
    looseRecord(ComposerRelease).transform((map) => Object.values(map)),
  ])
  .catch([]);
export type ComposerReleases = z.infer<typeof ComposerReleases>;

export const ComposerPackagesResponse = z
  .object({
    packageName: z.string(),
    packagesResponse: z.object({
      packages: z.record(z.unknown()),
    }),
  })
  .transform(
    ({ packageName, packagesResponse }) =>
      packagesResponse.packages[packageName]
  )
  .transform((xs) => ComposerReleases.parse(xs));
export type ComposerPackagesResponse = z.infer<typeof ComposerPackagesResponse>;

export function parsePackagesResponse(
  packageName: string,
  packagesResponse: unknown
): ComposerReleases {
  try {
    return ComposerPackagesResponse.parse({ packageName, packagesResponse });
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

export const HashSpec = z.union([
  z
    .object({ sha256: z.string().nullable() })
    .transform(({ sha256 }) => ({ hash: sha256 })),
  z
    .object({ sha1: z.string().nullable() })
    .transform(({ sha1 }) => ({ hash: sha1 })),
]);
export type HashSpec = z.infer<typeof HashSpec>;

export const RegistryFile = z.intersection(
  HashSpec,
  z.object({ key: z.string() })
);
export type RegistryFile = z.infer<typeof RegistryFile>;

export const PackagesResponse = z.object({
  packages: looseRecord(ComposerReleases),
});
export type PackagesResponse = z.infer<typeof PackagesResponse>;

export const PackagistFile = PackagesResponse.merge(
  z.object({
    providers: looseRecord(HashSpec).transform((x) =>
      Object.fromEntries(
        Object.entries(x).map(([key, { hash }]) => [key, hash])
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
        ['includes']: looseRecord(HashSpec).transform((x) =>
          Object.entries(x).map(([name, { hash }]) => ({ key: name, hash }))
        ),
        ['provider-includes']: looseRecord(HashSpec).transform((x) =>
          Object.entries(x).map(([key, { hash }]) => ({ key, hash }))
        ),
        ['providers-lazy-url']: looseValue(z.string()),
        ['providers-url']: looseValue(z.string()),
        ['metadata-url']: looseValue(z.string()),
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
      ['metadata-url']: metadataUrl,
    }) => ({
      packages,
      includesFiles,
      providerPackages,
      files,
      providersUrl,
      providersLazyUrl,
      metadataUrl,
      includesPackages: {} as Record<string, ReleaseResult | null>,
    })
  );
export type RegistryMeta = z.infer<typeof RegistryMeta>;
