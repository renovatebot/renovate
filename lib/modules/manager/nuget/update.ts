import semver, { ReleaseType } from 'semver';
import { logger } from '../../../logger';
import type { BumpPackageVersionResult } from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string | undefined,
  bumpVersion: ReleaseType | string
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump project version'
  );
  let bumpedContent = content;

  if (!currentValue) {
    logger.warn('Unable to bump project version, project has no version');
    return { bumpedContent };
  }

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump project version, not a valid semver'
    );
    return { bumpedContent };
  }

  try {
    const newProjVersion = semver.inc(currentValue, bumpVersion as ReleaseType);
    if (!newProjVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug(`newProjVersion: ${newProjVersion}`);
    logger.debug(`original content: ${content}`);

    bumpedContent = content.replace(
      `<Version>${currentValue}</Version>`,
      `<Version>${newProjVersion}</Version>`
    );
    logger.debug(`bumped content: ${bumpedContent}`);

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('project version bumped');
    }
  } catch (err) {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );
  }
  return { bumpedContent };
}
