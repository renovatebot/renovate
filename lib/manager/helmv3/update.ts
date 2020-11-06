import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): string {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump Chart.yaml version'
  );
  let newChartVersion: string;
  try {
    newChartVersion = inc(currentValue, bumpVersion as ReleaseType);
    if (!newChartVersion) {
      throw new Error('semver inc failed');
    }
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
