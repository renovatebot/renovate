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
    'Checking if we should bump Chart.yaml version'
  );
  let newChartVersion: string;
  let bumpedContent = content;
  try {
    newChartVersion = inc(currentValue, bumpVersion as ReleaseType);
    if (!newChartVersion) {
      throw new Error('semver inc failed');
    }
    logger.debug({ newChartVersion });
    bumpedContent = content.replace(
      /^(version:\s*).*$/m,
      `$1${newChartVersion}`
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
      'Failed to bumpVersion'
    );
  }
  return { bumpedContent };
}
