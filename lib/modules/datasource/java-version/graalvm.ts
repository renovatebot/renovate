import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { type Http, HttpError } from '../../../util/http/index.ts';
import { joinUrlParts } from '../../../util/url.ts';
import type { ReleaseResult } from '../types.ts';
import type { MiseJavaRelease, PackageConfig } from './types.ts';

export const graalvmRegistryUrl = 'https://mise-java.jdx.dev/';

export async function getGraalvmReleases(
  http: Http,
  pkgConfig: PackageConfig,
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

  const result: ReleaseResult = {
    homepage: 'https://www.oracle.com/java/graalvm/',
    sourceUrl: 'https://github.com/oracle/graal',
    registryUrl,
    releases: [],
  };

  try {
    const response = await http.getJsonUnchecked<MiseJavaRelease[]>(url);

    if (!response.body) {
      return null;
    }

    // Filter by vendor and image_type
    const filteredReleases = response.body
      .filter((release) => {
        return (
          release.vendor === 'oracle-graalvm' &&
          release.image_type === pkgConfig.imageType
        );
      })
      .map((release) => ({
        version: release.version,
      }));

    result.releases.push(...filteredReleases);
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.response?.statusCode === 404) {
        logger.debug({ url }, 'GraalVM releases not found (404)');
        return null;
      }
      throw new ExternalHostError(err);
    }

    throw err;
  }

  return result.releases.length ? result : null;
}
