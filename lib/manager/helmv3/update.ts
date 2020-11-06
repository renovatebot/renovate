import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';
import { Upgrade } from '../common';

export function bumpVersion(
  content: string,
  bumpVersionType: ReleaseType | string,
  upgrade: Upgrade,
): string {
  const currentValue = upgrade.packageFileVersion;
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump Chart.yaml version'
  );
  let newChartVersion: string;
  try {
    newChartVersion = inc(currentValue, bumpVersionType as ReleaseType);
    logger.debug({ newChartVersion });
    const bumpedContent = content.replace(
      /^(version:\s*")[^"]*$/,
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
