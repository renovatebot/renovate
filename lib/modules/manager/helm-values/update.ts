import { ReleaseType, inc } from 'semver';
import { logger } from '../../../logger';
import type { BumpPackageVersionResult } from '../types';
import { getSiblingChartYamlContent } from './util';

export async function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
  packageFile: string,
): Promise<BumpPackageVersionResult> {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump Chart.yaml version',
  );
  const chartYamlContent = await getSiblingChartYamlContent(packageFile);
  const newChartVersion = inc(currentValue, bumpVersion);
  if (!newChartVersion || chartYamlContent === null) {
    logger.warn(
      {
        chartYamlContent,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion',
    );
    return {
      bumpedContent: content,
    };
  }
  logger.debug({ newChartVersion });
  const bumpedContent = chartYamlContent?.replace(
    /^(version:\s*).*$/m,
    `$1${newChartVersion}`,
  );
  if (bumpedContent === chartYamlContent) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug('Bumped Chart.yaml version');
  }
  return {
    bumpedContent: content,
  };
}
