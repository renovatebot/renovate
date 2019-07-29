import { coerce } from 'semver';
import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult } from '../common';

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

interface GradleRelease {
  body: {
    snapshot?: boolean;
    nightly?: boolean;
    rcFor?: string;
    version: string;
    downloadUrl?: string;
    checksumUrl?: string;
  }[];
}

export async function getPkgReleases(
  _config: PkgReleaseConfig
): Promise<ReleaseResult> {
  try {
    const response: GradleRelease = await got(GradleVersionsServiceUrl, {
      json: true,
    });
    const releases = response.body
      .filter(release => !release.snapshot && !release.nightly)
      .filter(
        release =>
          // some milestone have wrong metadata and need to be filtered by version name content
          release.rcFor === '' && !release.version.includes('milestone')
      )
      .map(release => ({
        version: coerce(release.version).toString(),
        downloadUrl: release.downloadUrl,
        checksumUrl: release.checksumUrl,
      }));
    const gradle: ReleaseResult = {
      releases,
      homepage: 'https://gradle.org',
      sourceUrl: 'https://github.com/gradle/gradle',
    };
    return gradle;
  } catch (err) {
    logger.debug({ err });
    if (!(err.statusCode === 404 || err.code === 'ENOTFOUND')) {
      logger.warn({ err }, 'Gradle release lookup failure: Unknown error');
    }
    throw new Error('registry-failure');
  }
}
