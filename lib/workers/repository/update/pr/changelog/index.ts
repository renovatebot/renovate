import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import * as allVersioning from '../../../../../modules/versioning';
import { detectPlatform } from '../../../../../util/common';
import type { BranchUpgradeConfig } from '../../../../types';
import api from './api';
import type { ChangeLogSource } from './source';
import type { ChangeLogResult } from './types';

export * from './types';

export async function getChangeLogJSON(
  config: BranchUpgradeConfig,
): Promise<ChangeLogResult | null> {
  const { sourceUrl, versioning, currentVersion, newVersion } = config;
  try {
    if (!(sourceUrl && currentVersion && newVersion)) {
      return null;
    }
    const versioningApi = allVersioning.get(versioning);
    if (versioningApi.equals(currentVersion, newVersion)) {
      return null;
    }
    logger.debug(
      `Fetching changelog: ${sourceUrl} (${currentVersion} -> ${newVersion})`,
    );

    const platform = detectPlatform(sourceUrl);

    if (is.nullOrUndefined(platform)) {
      logger.info(
        { sourceUrl, hostType: platform },
        'Unknown platform, skipping changelog fetching.',
      );
      return null;
    }

    const changeLogSource = getChangeLogSourceFor(platform);

    if (is.nullOrUndefined(changeLogSource)) {
      logger.info(
        { sourceUrl, hostType: platform },
        'Unknown changelog source, skipping changelog fetching.',
      );
      return null;
    }

    return await changeLogSource.getChangeLogJSON(config);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ config, err }, 'getChangeLogJSON error');
    return null;
  }
}

export function getChangeLogSourceFor(
  platform: string,
): ChangeLogSource | null {
  return api.get(platform) ?? null;
}
