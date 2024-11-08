import { logger } from '../../logger';
import type {
  LookupUpdateConfig,
  UpdateResult,
} from '../../workers/repository/process/lookup/types';
import { getDatasourceFor } from './common';
import { Datasource } from './datasource';
import type { Release } from './types';

type Config = Partial<LookupUpdateConfig & UpdateResult>;

export async function postprocessRelease(
  config: Config,
  release: Release,
): Promise<Release | null> {
  const { datasource } = config;

  const ds = datasource && getDatasourceFor(datasource);
  if (!ds) {
    logger.once.warn(
      { datasource },
      'Failed to resolve datasource during release postprocessing',
    );
    return release;
  }

  if (
    ds.constructor.prototype.postprocessRelease ===
    Datasource.prototype.postprocessRelease
  ) {
    return release;
  }

  const { packageName } = config;
  if (!packageName) {
    logger.once.warn(
      { datasource },
      'Release postprocessing is not supported for empty `packageName` field',
    );
    return release;
  }

  const registryUrl = config.registryUrl ?? null;

  try {
    const result = await ds.postprocessRelease(
      { packageName, registryUrl },
      release,
    );

    if (result === 'reject') {
      if (config.extractVersion) {
        logger.debug(
          {
            datasource,
            packageName,
            registryUrl,
            version: release.version,
            extractVersion: config.extractVersion,
          },
          'Rejected release combined with `extractVersion`: preserving the release',
        );
        return release;
      }

      logger.debug(
        { datasource, packageName, registryUrl, version: release.version },
        'Rejected release',
      );
      return null;
    }

    return result;
  } catch (err) {
    logger.once.warn({ err }, `Release interceptor failed for "${datasource}"`);
    return release;
  }
}
