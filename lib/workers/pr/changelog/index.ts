import { logger } from '../../../logger';
import * as allVersioning from '../../../versioning';
import * as sourceGithub from './source-github';
import { getInRangeReleases } from './releases';
import { ChangeLogResult } from './common';
import { BranchUpgradeConfig } from '../../common';
import * as sourceGitlab from './source-gitlab';

export * from './common';

export async function getChangeLogJSON(
  args: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const { sourceUrl, versioning, fromVersion, toVersion } = args;
  try {
    if (!sourceUrl) {
      return null;
    }
    const version = allVersioning.get(versioning);
    if (!fromVersion || version.equals(fromVersion, toVersion)) {
      return null;
    }

    const releases = args.releases || (await getInRangeReleases(args));

    let res: ChangeLogResult | null = null;

    if (args.sourceUrl?.includes('gitlab')) {
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
