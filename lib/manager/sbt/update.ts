import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';
import { BumpPackageVersionResult } from '../common';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump build.sbt version'
  );
  let bumpedContent = content;
  const newVersion = inc(currentValue, bumpVersion as ReleaseType);
  if (!newVersion) {
    logger.warn('Version incremental failed');
    return { bumpedContent };
  }
  bumpedContent = content.replace(
    /^(version\s*:=\s*).*$/m,
    `$1"${newVersion}"`
  );

  if (bumpedContent === content) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug({ newVersion }, 'Bumped build.sbt version');
  }

  return { bumpedContent };
}
