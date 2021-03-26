import { logger } from '../../../logger';
import * as allVersioning from '../../../versioning';
import type { BranchUpgradeConfig } from '../../types';
import { getInRangeReleases } from './releases';
import * as sourceGithub from './source-github';
import * as sourceGitlab from './source-gitlab';
import type { ChangeLogResult } from './types';

export * from './types';

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
      args.sourceUrl?.includes('gitlab') ||
      (args.platform === 'gitlab' &&
        new URL(args.sourceUrl).hostname === new URL(args.endpoint).hostname)
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
