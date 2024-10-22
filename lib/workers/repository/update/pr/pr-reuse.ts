import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import { platform } from '../../../../modules/platform';
import type { Pr } from '../../../../modules/platform/types';
import type { BranchConfig } from '../../../types';

const REOPEN_THRESHOLD_MILLIS = 1000 * 60 * 60 * 24 * 7;

type Config = Pick<BranchConfig, 'branchName' | 'baseBranch'>;

export async function tryReuseBranchPr(config: Config): Promise<Pr | null> {
  if (!platform.tryReuseBranchPr) {
    return null;
  }

  const { branchName } = config;

  const autoclosedPr = await platform.findPr({ branchName, state: 'closed' });
  if (!autoclosedPr) {
    return null;
  }
  logger.debug({ autoclosedPr }, 'Found autoclosed PR for branch');

  if (!autoclosedPr.title.endsWith(' - autoclosed')) {
    return null;
  }

  const closedAt = autoclosedPr.closedAt;
  if (!closedAt) {
    return null;
  }

  const closedMillisAgo = DateTime.fromISO(closedAt)
    .diffNow()
    .negate()
    .toMillis();
  if (closedMillisAgo > REOPEN_THRESHOLD_MILLIS) {
    return null;
  }

  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would try to reopen autoclosed PR');
    return null;
  }

  try {
    const pr = await platform.tryReuseBranchPr(
      autoclosedPr,
      branchName,
      config.baseBranch,
    );
    return pr;
  } catch (err) {
    logger.debug(
      { err },
      `Error trying to reuse existing PR with branch=${branchName}`,
    );
    return null;
  }
}
