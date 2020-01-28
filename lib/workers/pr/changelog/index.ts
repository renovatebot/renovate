import { logger } from '../../../logger';
import * as versioning from '../../../versioning';
import * as sourceGithub from './source-github';
import { getReleases } from './releases';
import { ChangeLogConfig, ChangeLogResult } from './common';

export * from './common';

export async function getChangeLogJSON(
  args: ChangeLogConfig
): Promise<ChangeLogResult | null> {
  const { sourceUrl, versionScheme, fromVersion, toVersion } = args;
  if (!sourceUrl) {
    return null;
  }
  const version = versioning.get(versionScheme);
  if (!fromVersion || version.equals(fromVersion, toVersion)) {
    return null;
  }

  const releases = args.releases || (await getReleases(args));

  try {
    const res = await sourceGithub.getChangeLogJSON({ ...args, releases });
    return res;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getChangeLogJSON error');
    return null;
  }
}
