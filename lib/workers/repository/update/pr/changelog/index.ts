import { logger } from '../../../../../logger';
import { detectPlatform } from '../../../../../modules/platform/util';
import * as allVersioning from '../../../../../modules/versioning';
import type { BranchUpgradeConfig } from '../../../../types';
import * as sourceGithub from './source-github';
import * as sourceGitlab from './source-gitlab';
import type { ChangeLogResult } from './types';

export * from './types';

class SourceUrlContainer {
  private readonly sourceUrl: string;
  private readonly orgSourceUrl: string;

  constructor(config: BranchUpgradeConfig) {
    this.orgSourceUrl = config.sourceUrl as string;
    if (config.overwriteSourceUrl) {
      this.sourceUrl = config.overwriteSourceUrl as string;
    } else {
      this.sourceUrl = config.sourceUrl as string;
    }
  }

  get(): string {
    return this.sourceUrl;
  }

  restore(): string {
    return this.orgSourceUrl;
  }
}

export async function getChangeLogJSON(
  config: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const srcUrlContainer = new SourceUrlContainer(config);
  config.sourceUrl = srcUrlContainer.get();
  const { sourceUrl, versioning, currentVersion, newVersion } = config;
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

    config.sourceUrl = srcUrlContainer.restore();

    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ config, err }, 'getChangeLogJSON error');
    return null;
  }
}
