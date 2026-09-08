import { isNullOrUndefined } from '@sindresorhus/is';
import { instrument } from '../../../../../instrumentation/index.ts';
import { logger } from '../../../../../logger/index.ts';
import * as allVersioning from '../../../../../modules/versioning/index.ts';
import { ExternalHostError } from '../../../../../types/errors/external-host-error.ts';
import { detectPlatform } from '../../../../../util/common.ts';
import type { BranchUpgradeConfig } from '../../../../types.ts';
import api from './api.ts';
import type { ChangeLogSource } from './source.ts';
import type { ChangeLogResult } from './types.ts';

export * from './types.ts';

export async function getChangeLogJSON(
  config: BranchUpgradeConfig,
): Promise<ChangeLogResult | null> {
  return await instrument('getChangeLogJSON()', async () => {
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

      if (isNullOrUndefined(platform)) {
        logger.info(
          { sourceUrl, hostType: platform },
          'Unknown platform, skipping changelog fetching.',
        );
        return null;
      }

      const changeLogSource = getChangeLogSourceFor(platform);

      if (isNullOrUndefined(changeLogSource)) {
        logger.info(
          { sourceUrl, hostType: platform },
          'Unknown changelog source, skipping changelog fetching.',
        );
        return null;
      }

      return await changeLogSource.getChangeLogJSON(config);
    } catch (err) /* istanbul ignore next */ {
      // A changelog fetch is best-effort: on failure we return null and the
      // update proceeds. A transient external host error must not be logged at
      // error level, because logged errors alone cause a non-zero run exit.
      const logLevel = err instanceof ExternalHostError ? 'warn' : 'error';
      logger[logLevel]({ config, err }, 'getChangeLogJSON error');
      return null;
    }
  });
}

export function getChangeLogSourceFor(
  platform: string,
): ChangeLogSource | null {
  return api.get(platform) ?? null;
}
