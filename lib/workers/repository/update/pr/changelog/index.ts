import { logger } from '../../../../../logger';
import * as bitbucket from '../../../../../modules/platform/bitbucket';
import * as github from '../../../../../modules/platform/github';
import * as gitlab from '../../../../../modules/platform/gitlab';
import * as allVersioning from '../../../../../modules/versioning';
import { detectPlatform } from '../../../../../util/common';
import type { BranchUpgradeConfig } from '../../../../types';
import * as sourceBitbucket from './source-bitbucket';
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
      case gitlab.id:
        res = await sourceGitlab.getChangeLogJSON(config);
        break;
      case github.id:
        res = await sourceGithub.getChangeLogJSON(config);
        break;
      case bitbucket.id:
        res = await sourceBitbucket.getChangeLogJSON(config);
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
