import { logger } from '../../../../logger';
import { getDatasourceFor } from '../../../../modules/datasource/common';
import type { Release } from '../../../../modules/datasource/types';
import type { CandidateReleaseConfig } from './types';

export async function tryInterceptRelease(
  config: CandidateReleaseConfig & { datasource?: string },
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
