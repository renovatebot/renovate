import { ReleaseType, inc } from 'semver';
import { logger } from '../../logger';
import { getSiblingChartYamlContent } from './util';

export async function bumpPackageVersion(
  _content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string,
  packageFile: string
): Promise<string> {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump Chart.yaml version'
  );
  const chartYamlContent = await getSiblingChartYamlContent(packageFile);
  let newChartVersion: string;
  try {
    newChartVersion = inc(currentValue, bumpVersion as ReleaseType);
    if (!newChartVersion) {
      throw new Error('semver inc failed');
    }
    logger.debug({ newChartVersion });
    const bumpedContent = chartYamlContent.replace(
      /^(version:\s*).*$/m,
      `$1${newChartVersion}`
    );
    if (bumpedContent === chartYamlContent) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped Chart.yaml version');
    }
    return bumpedContent;
  } catch (err) {
    logger.warn(
      {
        chartYamlContent,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );
    return chartYamlContent;
  }
}
