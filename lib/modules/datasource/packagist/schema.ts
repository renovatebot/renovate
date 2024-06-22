import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { LooseArray, LooseRecord } from '../../../util/schema-utils';
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

export const ComposerRelease = z.object({
  version: z.string(),
  homepage: z.string().nullable().catch(null),
  source: z.object({ url: z.string() }).nullable().catch(null),
  time: z.string().nullable().catch(null),
  require: z.object({ php: z.string() }).nullable().catch(null),
});
export type ComposerRelease = z.infer<typeof ComposerRelease>;

export const ComposerReleases = z
  .union([
    MinifiedArray.pipe(LooseArray(ComposerRelease)),
    LooseRecord(ComposerRelease).transform((map) => Object.values(map)),
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
      packagesResponse.packages[packageName],
  )
  .transform((xs) => ComposerReleases.parse(xs));
export type ComposerPackagesResponse = z.infer<typeof ComposerPackagesResponse>;

export function parsePackagesResponse(
  packageName: string,
  packagesResponse: unknown,
): ComposerReleases {
  try {
    return ComposerPackagesResponse.parse({ packageName, packagesResponse });
  } catch (err) {
    logger.debug(
      { packageName, err },
      `Error parsing packagist response for ${packageName}`,
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
  composerReleases: unknown,
): ReleaseResult | null {
  const parsedReleases = ComposerReleases.parse(composerReleases);
  return extractReleaseResult(parsedReleases);
}

export function parsePackagesResponses(
  packageName: string,
  packagesResponses: unknown[],
): ReleaseResult | null {
  const releaseArrays = packagesResponses.map((pkgResp) =>
    parsePackagesResponse(packageName, pkgResp),
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
  z.object({ key: z.string() }),
);
export type RegistryFile = z.infer<typeof RegistryFile>;

export const PackagesResponse = z.object({
  packages: LooseRecord(ComposerReleases).catch({}),
});
export type PackagesResponse = z.infer<typeof PackagesResponse>;

export const PackagistFile = PackagesResponse.merge(
  z.object({
    providers: LooseRecord(HashSpec)
      .transform((x) =>
        Object.fromEntries(
          Object.entries(x).map(([key, { hash }]) => [key, hash]),
        ),
      )
      .catch({}),
  }),
);
export type PackagistFile = z.infer<typeof PackagistFile>;

export const RegistryMeta = z
  .record(z.unknown())
  .catch({})
  .pipe(
    PackagistFile.merge(
      z.object({
        ['includes']: LooseRecord(HashSpec)
          .transform((x) =>
            Object.entries(x).map(([name, { hash }]) => ({ key: name, hash })),
          )
          .catch([]),
        ['provider-includes']: LooseRecord(HashSpec)
          .transform((x) =>
            Object.entries(x).map(([key, { hash }]) => ({ key, hash })),
          )
          .catch([]),
        ['providers-lazy-url']: z.string().nullable().catch(null),
        ['providers-url']: z.string().nullable().catch(null),
        ['metadata-url']: z.string().nullable().catch(null),
        ['available-packages']: z.array(z.string()).nullable().catch(null),
      }),
    ),
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
      ['available-packages']: availablePackages,
    }) => ({
      packages,
      includesFiles,
      providerPackages,
      files,
      providersUrl,
      providersLazyUrl,
      metadataUrl,
      includesPackages: {} as Record<string, ReleaseResult | null>,
      availablePackages,
    }),
  );
export type RegistryMeta = z.infer<typeof RegistryMeta>;
