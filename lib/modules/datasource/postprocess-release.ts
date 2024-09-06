import { logger } from '../../logger';
import { getDatasourceFor } from './common';
import type { PostprocessReleaseConfig, Release } from './types';

export async function postprocessRelease(
  config: PostprocessReleaseConfig,
  release: Release,
): Promise<Release | null> {
  const { datasource } = config;

  if (!datasource) {
    return release;
  }

  const ds = getDatasourceFor(datasource);
  if (!ds) {
    return release;
  }

  if (!ds.interceptRelease) {
    return release;
  }

  try {
    const result = await ds.interceptRelease(
      {
        packageName: config.packageName,
        registryUrl: config.registryUrl,
        currentValue: config.currentValue,
      },
      release,
    );
    return result;
  } catch (err) {
    logger.debug({ err }, `Release interceptor failed for "${datasource}"`);
    return release;
  }
}
