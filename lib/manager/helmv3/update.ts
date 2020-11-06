import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';
import { BumpVersionConfig } from '../common';

export function bumpVersion(
  config: BumpVersionConfig,
): string {
  const bumpVersionType = config.bumpVersionType;
  const content = config.content;
  const currentValue = config.currentValue;
  logger.debug(
    { bumpVersionType, currentValue },
    'Checking if we should bump Chart.yaml version'
  );
  let newChartVersion: string;
  try {
    newChartVersion = inc(currentValue, bumpVersionType as ReleaseType);
    logger.debug({ newChartVersion });
    const bumpedContent = content.replace(
      /^(version:\s*).*$/m,
      `$1${newChartVersion}`
    );
    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped Chart.yaml version');
    }
    return bumpedContent;
  } catch (err) {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );
    return content;
  }
}
