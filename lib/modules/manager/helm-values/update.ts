import { ReleaseType, inc } from 'semver';
import { logger } from '../../../logger';
import { getSiblingFileName } from '../../../util/fs';
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
  const chartFileName = getSiblingFileName(packageFile, 'Chart.yaml');
  const chartYamlContent = await getSiblingChartYamlContent(packageFile);
  try {
    const newChartVersion = inc(currentValue, bumpVersion);
    if (!newChartVersion) {
      throw new Error('semver inc failed');
    }
    if (chartYamlContent === null) {
      throw new Error(
        'Cannot bump chart version because Chart.yaml could not be read.',
      );
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
      bumpedFiles: [{ fileName: chartFileName, newContent: bumpedContent }],
    };
  } catch (err) {
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
}
