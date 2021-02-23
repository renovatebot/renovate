import { PLATFORM_TYPE_GITLAB } from '../../../constants/platforms';
import { logger } from '../../../logger';
import { compareHosts } from '../../../util/url';
import * as allVersioning from '../../../versioning';
import { BranchUpgradeConfig } from '../../common';
import { ChangeLogResult } from './common';
import { getInRangeReleases } from './releases';
import * as sourceGithub from './source-github';
import * as sourceGitlab from './source-gitlab';

export * from './common';

export async function getChangeLogJSON(
  args: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const { sourceUrl, versioning, currentVersion, newVersion } = args;
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
    const releases = args.releases || (await getInRangeReleases(args));

    let res: ChangeLogResult | null = null;

    if (
      (args.platform === PLATFORM_TYPE_GITLAB &&
        compareHosts(args.sourceUrl, args.endpoint)) ||
      args.sourceUrl?.includes('gitlab')
    ) {
      res = await sourceGitlab.getChangeLogJSON({ ...args, releases });
    } else {
      res = await sourceGithub.getChangeLogJSON({ ...args, releases });
    }
    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ config: args, err }, 'getChangeLogJSON error');
    return null;
  }
}
