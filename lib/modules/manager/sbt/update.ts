import semver, { ReleaseType } from 'semver';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { BumpPackageVersionResult } from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump build.sbt version',
  );
  let bumpedContent = content;
  const bumpedVersion = semver.inc(currentValue, bumpVersion);
  if (!bumpedVersion) {
    logger.warn('Version incremental failed');
    return { bumpedContent };
  }
  bumpedContent = content.replace(
    regEx(/^(version\s*:=\s*).*$/m),
    `$1"${bumpedVersion}"`,
  );

  if (bumpedContent === content) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug(`Bumped build.sbt version to ${bumpedVersion}`);
  }

  return { bumpedContent };
}
