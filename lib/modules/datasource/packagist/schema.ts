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

const RegistryFile = z.object({
  key: z.string(),
  sha256: z.string(),
});
export type RegistryFile = z.infer<typeof RegistryFile>;

const RegistryMetaFile = z.object({
  sha256: z.string().nullable(),
});
type RegistryMetaFile = z.infer<typeof RegistryMetaFile>;

const RegistryMetaFiles = z
  .record(RegistryMetaFile.nullable().catch(null))
  .transform((obj) => {
    // Remove all null values
    // TODO: extract as schema utility
    const result: Record<string, RegistryMetaFile> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== null) {
        result[key] = val;
      }
    }
    return result;
  });

export const RegistryMeta = z
  .object({
    ['includes']: RegistryMetaFiles.transform((obj): RegistryFile[] => {
      const result: RegistryFile[] = [];
      for (const [name, { sha256 }] of Object.entries(obj)) {
        if (sha256) {
          const key = name.replace(sha256, '%hash%');
          result.push({ key, sha256 });
        }
      }
      return result;
    })
      .nullable()
      .catch(null),
    ['providers']: RegistryMetaFiles.transform((obj) => {
      const result: Record<string, string | null> = {};
      for (const [key, { sha256 }] of Object.entries(obj)) {
        result[key] = sha256;
      }
      return result;
    }).catch({}),
    ['provider-includes']: RegistryMetaFiles.transform(
      (obj): RegistryFile[] => {
        const result: RegistryFile[] = [];
        for (const [key, { sha256 }] of Object.entries(obj)) {
          if (sha256) {
            result.push({ key, sha256 });
          }
        }
        return result;
      }
    )
      .nullable()
      .catch(null),
    ['providers-url']: z.string().nullable().catch(null),
    ['providers-lazy-url']: z.string().optional().nullable().catch(null),
  })
  .transform(
    ({
      ['includes']: includesFiles,
      ['providers']: providerPackages,
      ['provider-includes']: files,
      ['providers-url']: providersUrl,
      ['providers-lazy-url']: providersLazyUrl,
    }) => ({
      includesFiles,
      providerPackages,
      files,
      providersUrl,
      providersLazyUrl,
    })
  );
export type RegistryMeta = z.infer<typeof RegistryMeta>;
