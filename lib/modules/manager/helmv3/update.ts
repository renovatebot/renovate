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
    'Checking if we should bump Chart.yaml version',
  );
  let newChartVersion: string | null;
  let bumpedContent = content;

  try {
    newChartVersion = semver.inc(currentValue, bumpVersion);
    if (!newChartVersion) {
      throw new Error('semver inc failed');
    }
    logger.debug(`newChartVersion: ${newChartVersion}`);
    bumpedContent = content.replace(
      regEx(`^(?<version>version:\\s*).*$`, 'm'),
      `$<version>${newChartVersion}`,
    );
    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped Chart.yaml version');
    }
  } catch (err) {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion',
    );
  }
  return { bumpedContent };
}
