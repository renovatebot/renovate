import { logger } from '../../../../../logger';
import * as allVersioning from '../../../../../modules/versioning';
import { detectPlatform } from '../../../../../util/common';
import type { BranchUpgradeConfig } from '../../../../types';
import * as sourceGithub from './source-github';
import * as sourceGitlab from './source-gitlab';
import type { ChangeLogResult } from './types';

export * from './types';

export async function getChangeLogJSON(
  _config: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const sourceUrl = _config.customChangelogUrl ?? _config.sourceUrl!;
  const config: BranchUpgradeConfig = { ..._config, sourceUrl };
  const { versioning, currentVersion, newVersion } = config;
  try {
    if (!(sourceUrl && currentVersion && newVersion)) {
      return null;
    }
    const version = allVersioning.get(versioning);
    if (version.equals(currentVersion, newVersion)) {
      return null;
    }
    logger.debug(
      `Fetching changelog: ${sourceUrl} (${currentVersion} -> ${newVersion})`
    );

    let res: ChangeLogResult | null = null;

    const platform = detectPlatform(sourceUrl);

    switch (platform) {
      case 'gitlab':
        res = await sourceGitlab.getChangeLogJSON(config);
        break;
      case 'github':
        res = await sourceGithub.getChangeLogJSON(config);
        break;

      default:
        logger.info(
          { sourceUrl, hostType: platform },
          'Unknown platform, skipping changelog fetching.'
        );
        break;
    }

    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ config, err }, 'getChangeLogJSON error');
    return null;
  }
}
