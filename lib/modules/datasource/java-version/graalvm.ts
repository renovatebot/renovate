import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { type Http, HttpError } from '../../../util/http/index.ts';
import { isNotFound } from '../../../util/http/status.ts';
import { joinUrlParts } from '../../../util/url.ts';
import type { ReleaseResult } from '../types.ts';
import { MiseJavaRelease } from './schema.ts';
import type { GraalvmVendor, PackageConfig } from './types.ts';

export const graalvmRegistryUrl = 'https://mise-java.jdx.dev/';

interface MiseJavaVendor {
  /** Vendor name used in the mise-java metadata */
  vendor: string;
  homepage: string;
  sourceUrl: string;
}

const miseJavaVendors: Record<GraalvmVendor, MiseJavaVendor> = {
  'oracle-graalvm': {
    vendor: 'oracle-graalvm',
    homepage: 'https://www.oracle.com/java/graalvm/',
    sourceUrl: 'https://github.com/oracle/graal',
  },
  // GraalVM CE before GraalVM for JDK 17, e.g. `22.3.3+java17`
  'graalvm-ce': {
    vendor: 'graalvm',
    homepage: 'https://www.graalvm.org/',
    sourceUrl: 'https://github.com/graalvm/graalvm-ce-builds',
  },
};

export async function getGraalvmReleases(
  http: Http,
  pkgConfig: PackageConfig<GraalvmVendor>,
  registryUrl: string,
): Promise<ReleaseResult | null> {
  logger.trace({ pkgConfig, registryUrl }, 'fetching GraalVM releases');

  // Build URL: /jvm/{releaseType}/{os}/{architecture}.json
  // If system detection returns null, we can't fetch - return null
  if (!pkgConfig.os || !pkgConfig.architecture) {
    logger.debug(
      { os: pkgConfig.os, architecture: pkgConfig.architecture },
      'Cannot fetch GraalVM releases without OS and architecture',
    );
    return null;
  }

  const releaseType = pkgConfig.releaseType ?? 'ga';

  const url = joinUrlParts(
    registryUrl,
    'jvm',
    releaseType,
    pkgConfig.os,
    `${pkgConfig.architecture}.json`,
  );

  const { vendor, homepage, sourceUrl } = miseJavaVendors[pkgConfig.vendor];
  const result: ReleaseResult = {
    homepage,
    sourceUrl,
    registryUrl,
    releases: [],
  };

  try {
    const response = await http.getJson(url, z.array(MiseJavaRelease));

    // Filter by vendor and image_type
    const filteredReleases = response.body
      .filter((release) => {
        return (
          release.vendor === vendor &&
          release.image_type === pkgConfig.imageType
        );
      })
      .map(({ version, created_at }) => ({
        version,
        // `created_at` is when mise-java first indexed the build, which is
        // never earlier than the actual release
        ...(created_at && { releaseTimestamp: created_at }),
      }));

    result.releases.push(...filteredReleases);
  } catch (err) {
    if (err instanceof HttpError) {
      if (isNotFound(err)) {
        logger.debug({ url }, 'GraalVM releases not found (404)');
        return null;
      }
      throw new ExternalHostError(err);
    }

    throw err;
  }

  return result.releases.length ? result : null;
}
