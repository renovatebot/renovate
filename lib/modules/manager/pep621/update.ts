import { inc } from '@renovatebot/pep440';
import type { ReleaseType } from 'semver';
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
    'Checking if we should bump pyproject.toml version',
  );

  let bumpedContent = content;
  try {
    const newProjectVersion = inc(currentValue, bumpVersion);
    if (!newProjectVersion) {
      throw new Error('pep440 inc failed');
    }

    logger.debug(`newProjectVersion: ${newProjectVersion}`);
    bumpedContent = content.replace(
      regEx(`^(?<version>version[ \\t]*=[ \\t]*['"])[^'"]*`, 'm'),
      `$<version>${newProjectVersion}`,
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped pyproject.toml version');
    }
  } catch {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
        manager: 'pep621',
      },
      'Failed to bumpVersion',
    );
  }

  return { bumpedContent };
}
