import { logger } from '../../../logger';
import * as allVersioning from '../../../versioning';
import * as sourceGithub from './source-github';
import { getInRangeReleases } from './releases';
import { ChangeLogResult } from './common';
import { BranchUpgradeConfig } from '../../common';

export * from './common';

export async function getChangeLogJSON(
  args: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const { sourceUrl, versioning, fromVersion, toVersion } = args;
  if (!sourceUrl) {
    return null;
  }
  const version = allVersioning.get(versioning);
  if (!fromVersion || version.equals(fromVersion, toVersion)) {
    return null;
  }

  const releases = args.releases || (await getInRangeReleases(args));

  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args, releases });
    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getChangeLogJSON error');
    return null;
  }
}
