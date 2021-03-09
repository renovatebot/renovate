import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';
import type { BumpPackageVersionResult } from '../types';

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
  const bumpedVersion = inc(currentValue, bumpVersion as ReleaseType);
  if (!bumpedVersion) {
    logger.warn('Version incremental failed');
    return { bumpedContent };
  }
  bumpedContent = content.replace(
    /^(version\s*:=\s*).*$/m,
    `$1"${bumpedVersion}"`
  );

  if (bumpedContent === content) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug({ bumpedVersion }, 'Bumped build.sbt version');
  }

  return { bumpedContent };
}
