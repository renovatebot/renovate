import { type ReleaseType, inc } from 'semver';
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
    'Checking if we should bump OCB version',
  );

  let bumpedContent = content;
  try {
    const newProjectVersion = inc(currentValue, bumpVersion);
    if (!newProjectVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug(`newProjectVersion: ${newProjectVersion}`);
    bumpedContent = content.replace(
      regEx(/\b(?<version>version:\s+["']?)(?<currentValue>[^'"\s]*)/),
      `$<version>${newProjectVersion}`,
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped OCB version');
    }
  } catch {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
        manager: 'ocb',
      },
      'Failed to bumpVersion',
    );
  }

  return { bumpedContent };
}
